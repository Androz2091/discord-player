// prettier-ignore
import {
  BaseExtractor,
  ExtractorInfo,
  ExtractorSearchContext,
  QueryType,
  SearchQueryType,
  Track,
  Util
} from 'discord-player';
import type { IncomingMessage } from 'http';
import { createReadStream, existsSync } from 'fs';
import { downloadStream } from '../internal/downloader';
import * as fileType from 'file-type';
import path from 'path';
import { stat } from 'fs/promises';

const ATTACHMENT_HEADER = [
  'audio/',
  'video/',
  'application/ogg',
  'raw/pcm',
  'raw/opus',
] as const;

export class AttachmentExtractor extends BaseExtractor {
  public static identifier = 'com.discord-player.attachmentextractor' as const;

  // use lowest priority to avoid conflict with other extractors
  public priority = 0;

  public async validate(
    query: string,
    type?: SearchQueryType | null | undefined,
  ): Promise<boolean> {
    if (typeof query !== 'string') return false;
    return ([QueryType.ARBITRARY, QueryType.FILE] as SearchQueryType[]).some(
      (r) => r === type,
    );
  }

  public async getRelatedTracks(track: Track) {
    void track;
    return this.createResponse();
  }

  public async handle(
    query: string,
    context: ExtractorSearchContext,
  ): Promise<ExtractorInfo> {
    switch (context.type) {
      case QueryType.ARBITRARY: {
        const data = (await downloadStream(
          query,
          context.requestOptions,
        )) as IncomingMessage;
        if (
          !ATTACHMENT_HEADER.some(
            (r) => !!data.headers['content-type']?.startsWith(r),
          )
        )
          return this.emptyResponse();

        const trackInfo = {
          title: (
            query
              .split('/')
              .filter((x) => x.length)
              .pop() ?? 'Attachment'
          )
            .split('?')[0]
            .trim(),
          duration: 0,
          thumbnail:
            'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png',
          engine: query,
          // eslint-disable-next-line
          author: ((data as any).client?.servername as string) || 'Attachment',
          description:
            // eslint-disable-next-line
            ((data as any).client?.servername as string) || 'Attachment',
          url: data.url || query,
        };

        try {
          // eslint-disable-next-line
          const mediaplex = require('mediaplex') as typeof import('mediaplex');
          const timeout = this.context.player.options.probeTimeout ?? 5000;

          const { result, stream } = (await Promise.race([
            mediaplex.probeStream(data),
            new Promise((_, r) => {
              setTimeout(() => r(new Error('Timeout')), timeout);
            }),
          ])) as Awaited<ReturnType<typeof mediaplex.probeStream>>;

          if (result) {
            trackInfo.duration = result.duration * 1000;

            const metadata = mediaplex.readMetadata(result);
            if (metadata.author) trackInfo.author = metadata.author;
            if (metadata.title) trackInfo.title = metadata.title;

            trackInfo.description = `${trackInfo.title} by ${trackInfo.author}`;
          }

          stream.destroy();
        } catch {
          //
        }

        const track = new Track(this.context.player, {
          title: trackInfo.title,
          url: trackInfo.url,
          duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration)),
          description: trackInfo.description,
          thumbnail: trackInfo.thumbnail,
          views: 0,
          author: trackInfo.author,
          requestedBy: context.requestedBy,
          source: 'arbitrary',
          engine: trackInfo.url,
          queryType: context.type,
          metadata: trackInfo,
          async requestMetadata() {
            return trackInfo;
          },
        });

        track.extractor = this;

        track.raw.isFile = false;

        return { playlist: null, tracks: [track] };
      }
      case QueryType.FILE: {
        if (!existsSync(query)) return this.emptyResponse();
        const fstat = await stat(query);
        if (!fstat.isFile()) return this.emptyResponse();

        const fileExt = path.extname(query).toLowerCase();
        const mime = await fileType
          .fromFile(query)
          .then((v) => {
            if (v) return v;
            if (/\.(opus|pcm)$/.test(fileExt))
              return { mime: `raw/${fileExt.replace('.', '')}` };
          })
          .catch(() => null);

        if (!mime || !ATTACHMENT_HEADER.some((r) => !!mime.mime.startsWith(r)))
          return this.emptyResponse();

        const trackInfo = {
          title: path.basename(query) || 'Attachment',
          duration: 0,
          thumbnail:
            'https://upload.wikimedia.org/wikipedia/commons/2/2a/ITunes_12.2_logo.png',
          engine: query,
          author: 'Attachment',
          description: 'Attachment',
          url: query,
        };

        const isRaw = /raw\/(pcm|opus)/.test(mime.mime);

        if (!isRaw) {
          try {
            const mediaplex =
              // eslint-disable-next-line
              require('mediaplex') as typeof import('mediaplex');

            const timeout = this.context.player.options.probeTimeout ?? 5000;

            const { result, stream } = (await Promise.race([
              mediaplex.probeStream(
                createReadStream(query, {
                  start: 0,
                  end: 1024 * 1024 * 10,
                }),
              ),
              new Promise((_, r) => {
                setTimeout(() => r(new Error('Timeout')), timeout);
              }),
            ])) as Awaited<ReturnType<typeof mediaplex.probeStream>>;

            if (result) {
              trackInfo.duration = result.duration * 1000;

              const metadata = mediaplex.readMetadata(result);
              if (metadata.author) trackInfo.author = metadata.author;
              if (metadata.title) trackInfo.title = metadata.title;

              trackInfo.description = `${trackInfo.title} by ${trackInfo.author}`;
            }

            stream.destroy();
          } catch {
            //
          }
        } else {
          const isPcm = /raw\/pcm/.test(mime.mime);

          if (isPcm) {
            const details = estimatePCMProperties(fstat);

            if (details) {
              trackInfo.duration = Math.round(details.duration) * 1000;
            }
          } else {
            const details = estimateOpusProperties(fstat);

            if (details) {
              trackInfo.duration = Math.round(details.duration) * 1000;
            }
          }
        }

        const track = new Track(this.context.player, {
          title: trackInfo.title,
          url: trackInfo.url,
          duration: Util.buildTimeCode(Util.parseMS(trackInfo.duration)),
          description: trackInfo.description,
          thumbnail: trackInfo.thumbnail,
          views: 0,
          author: trackInfo.author,
          requestedBy: context.requestedBy,
          source: 'arbitrary',
          engine: trackInfo.url,
          queryType: context.type,
          metadata: trackInfo,
          async requestMetadata() {
            return trackInfo;
          },
        });

        track.extractor = this;
        track.raw.isFile = true;
        track.raw.mime = mime.mime.split('/')[1];

        return { playlist: null, tracks: [track] };
      }
      default:
        return this.emptyResponse();
    }
  }

  public emptyResponse(): ExtractorInfo {
    return { playlist: null, tracks: [] };
  }

  public async stream(info: Track) {
    const engine = info.raw.engine as string;

    const isFile = info.raw.isFile as boolean;

    if (!engine) throw new Error('Could not find stream source');

    if (!isFile) {
      return engine;
      // return await downloadStream(engine);
    }

    const stream = createReadStream(engine);

    return {
      stream,
      $fmt: info.raw.mime as string,
    };
  }
}

function estimatePCMProperties(
  stats: import('node:fs').Stats,
  sampleSize = 2,
  channels = 2,
  sampleRate = 48000,
) {
  const fileSize = stats.size;
  const durationInSeconds = fileSize / (sampleSize * channels * sampleRate);

  return {
    sampleSize,
    channels,
    sampleRate,
    duration: !Number.isFinite(durationInSeconds) ? 0 : durationInSeconds,
  };
}

function estimateOpusProperties(
  stats: import('node:fs').Stats,
  bitrate = 96000,
  channels = 2,
) {
  const fileSize = stats.size;
  const sampleRate = 48000;
  const bitsPerSample = 16;

  const duration = (fileSize * 8) / bitrate;

  return {
    bitrate,
    channels,
    sampleRate,
    bitsPerSample,
    duration: !Number.isFinite(duration) ? 0 : duration,
  };
}
