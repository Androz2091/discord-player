import { BaseExtractor, Track } from '../../src/index.js';

export const matchingUrl = 'https://media.example.test/creator/item';

export const exhaustedUrl = 'https://media.example.test/creator/exhausted';

/** Reproduces a permissive extractor claiming a URL owned by another provider. */
export class PermissiveExtractor extends BaseExtractor {
  static override identifier = 'fixture.permissive-provider';

  override priority = 20;

  override async validate() {
    return true;
  }

  override async handle(query: string) {
    if (query.includes('media.example.test')) throw new Error('Unsupported source URL.');

    return this.createResponse();
  }
}

/** Correctly claims and resolves the matching test URLs. */
export class MatchingExtractor extends BaseExtractor {
  static override identifier = 'fixture.matching-provider';

  override priority = 10;

  override async validate(query: string) {
    return query.includes('media.example.test');
  }

  override async handle(query: string) {
    if (query === exhaustedUrl) throw new Error('Matching provider resolution failed.');

    return this.createResponse(null, [
      new Track(this.context.player, {
        title: 'Matching provider result',
        url: query,
      }),
    ]);
  }
}

/** Matching candidate used to verify provider-attributed exhausted failures. */
export class BrokenMatchingExtractor extends MatchingExtractor {
  static override identifier = 'fixture.matching-provider-broken';

  override async handle(_query: string): Promise<never> {
    throw new Error('Matching provider resolution failed.');
  }
}
