# Contributing Guide

## Introduction

Hello there, are you interested in contributing to discord-player but you are not sure how? You are in a right place. This guide explains how discord-player works under the hood so you can pin-point what you want to change without having to look through everything.

First of all, lets understand what this project is about. Discord Player is a high level framework built on top of [discord-voip](https://github.com/discord-player/discord-voip), a fork of [@discordjs/voice](https://github.com/discordjs/discord.js). `discord-voip` is a low level library to interact with [Discord](https://discord.com)'s VoIP. In other words, lets imagine discord-voip library as a brick and discord-player as a house built with that brick.

Discord lets you communicate with your friends real-time with voice channels. Guess what, bots can do so too. This concept is what people have been using to build bots that speak up "music" (literally) in Discord voice channels. This allows you to listen to the music together with your friends right inside Discord.

So how do these bots speak up "music" inside a voice channel? Well, this is done with the help of VoIP API given by Discord. You can read more about it [here](https://discord.com/developers/docs/topics/voice-connections). In a nutshell, we get audio stream from the "source", which can be internet source or local file for example. We then transform that source into raw opus packets with the help of several tools if needed. Once we have raw opus packets ready, we send it to Discord, which then reaches our ears :ear:. Sounds cool right?

Let's get back to `discord-voip` as mentioned earlier. `discord-voip` library is responsible for taking our source, transforming it into opus packets if necessary, and streaming it over Discord voice channel. It manages our bot's voice connection, audio resource, and other lifecycle events related to it.

Discord Player on the other hand, provides abstraction over `discord-voip` allowing you to quickly bootstrap a bot that can stream audio over Discord. Discord Player takes care of a lot of workloads to provide smooth developer experience.

## Discord Player

Like we discussed earlier, discord-player is a high level framework built on top of `discord-voip` library. It includes features such as queue management, voice connection handling, stream management, digital signal processing, and many more. Queue in discord-player is pretty much the same as queue data structure, we place audio track from one end and consume from the other end, which basically works in First-in-First-out principle (Except queue history works in Last-in-First-out principle which works similar to stack data structure).

When we first bootstrap discord-player, it immediately registers `VoiceStateUpdate` event listener to capture voice state updates received from Discord. This allows discord-player to smartly manage the resources based on voice connection state. For example, if nobody is listening to the audio, it can simply pause or disconnect to save the resources.

A typical music bot invokes the `play` method of discord-player with `voice channel` as the first argument, `query` as the second argument and `options` as the third argument. Upon invoking this method, discord-player checks if there is a queue associated with the guild that owns the voice channel. If there is no queue, discord-player bootstraps the queue with provided options. It then looks up for appropriate track based on the provided query with the registered extractors in its registry. Extractors are external classes that handle search queries and streaming of the source. When appropriate results are found, discord-player checks if the queue has active track. If there is no active track, the resolved track is scheduled to be played immediately, otherwise it will be added to the queue. The queue is smart enough to pick up the next track when current track is done consuming. But there are different steps involved in between source stream and discord-voip, which is handled in a smart way.

Discord Player has been utilizing [FFmpeg](https://ffmpeg.org) as a way to transcode incoming source into consumable format, which is mostly a signed 16-bit little endian PCM audio. But sometimes in order to save resources, discord-player tries to decode the incoming source without ffmpeg when possible. The intermmediate steps in between this may look complex but it is fairly simple.

When extractor returns a stream with demuxable format, discord-player analyzes if it needs to invoke ffmpeg or not. In this particular situation, FFmpeg is only needed when the queue is using FFmpeg audio filters, or is using `seek` parameter. If FFmpeg is not needed, it directly proceeds to demuxer api. Before demuxing the source, discord-player analyzes if any of the digital signal processors are in use. In other words, things such as `VolumeTransformer`, `Equalizer`, `BiquadFilter`, etc. are all under digital signal processor api. If none of these processors are in use, discord-player invokes demuxer to directly output opus packets if possible (opus packets are present in webm/opus or ogg/opus formats). Otherwise, it initializes digital signal processors pipeline that provide support for on-the-fly volume transformation, equalization and more. This allows bots to add audio filters functionality. Audio filtering in FFmpeg is a bit complicated than this though. When ffmpeg filters are requested, discord-player tracks the current progress and spins up a completely new FFmpeg process with `seek` parameter applied that starts next stream from roughly last made progress. When new stream is ready, it sets the queue into transition mode and stops the current stream. It then starts to consume new stream and disables transition mode. This process is smooth enough in most cases, however it can cause long delay depending upon the source stream. FFmpeg is handled in this way because discord-player relies on a child process to execute ffmpeg. When everything is ready, discord-player passes the stream to discord-voip, which is responsible for transforming the stream into opus stream if needed. Rest of the operations are taken care of by discord-voip behind the scenes.

## Project Structure

The discord-player project is structured into several packages:

- `discord-player`: The main source code for discord-player.
- `@discord-player/utils`: Basic utilities required by discord-player.
- `@discord-player/equalizer`: Digital signal processing utilities.
- `@discord-player/extractor`: A collection of extractors for bootstrapping music bots.
- `@discord-player/ffmpeg`: Streamable API for managing FFmpeg processes.
- `@discord-player/opus`: Streamable API over libopus bindings.

## Contributing

If you're interested in contributing, follow these steps:

1. **Creating a New Package:**
   Run `yarn bootstrap <packageName>` to create a new package. For example, `yarn bootstrap api` creates `@discord-player/api` in the `packages` directory.

2. **Testing Changes:**
   Run `yarn build` to build your changes. After successful build, use `yarn bot` to launch a testing bot located at `apps/music-bot`. Modify the source code or `.env` file if needed.

3. **Code Formatting:**
   The project uses `prettier` for code formatting.

4. **Linting:**
   `eslint` is used for codebase linting.

5. **Package Manager:**
   The project utilizes `yarn` as its package manager.

6. **Monorepo:**
   The project employs yarn workspace with turborepo.

7. **Versioning:**
   **Do not modify package versions**; core maintainers handle versioning.

8. **Commits:**
   Although it is not necessary, it is recommended to use [conventional commits message](https://www.conventionalcommits.org/en/v1.0.0/) to briefly describe what the update does.

9. **Documentation:**
   `typedoc` generates documentation based on JSDoc comments and TypeScript typings. The website is built using `next.js` and `tailwindcss`.

## Project Authors

- [androz2091](https://github.com/androz2091): Owner, Original author
- [twlite](https://github.com/twlite): Core maintainer, collaborator
- [discord-player](https://github.com/discord-player): Community organization under [AndrozDev](https://github.com/AndrozDev), dedicated to discord-player related projects.

Feel free to dive into the code, enhance functionalities, and contribute to the discord-player community!
