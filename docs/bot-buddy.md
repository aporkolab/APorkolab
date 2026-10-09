# Bot Buddy

A tiny GitHub-native companion to [Whack-a-Bug](https://aporkolab.github.io/). The robot is an SVG image; its state lives in git.

## Take a turn

Use a coffee, debug, or nap link on the profile, then submit the prefilled issue. Keep the title unchanged. The action accepts only these exact commands:

| Issue title | Effect |
| --- | --- |
| `[buddy] coffee` | A coffee break and an energy boost |
| `[buddy] debug` | A bug-hunting shift that spends energy |
| `[buddy] nap` | Rest and recharge |

There is a 15-minute per-person cooldown. Valid commands are processed in sequence; repeated workflow runs do not count the same issue twice. Commands that arrive during cooldown are closed without changing the interaction count. Ordinary issues are left alone.

The profile image updates after GitHub Actions finishes. GitHub may cache the image briefly. This is an asynchronous game, and it requires a GitHub account to submit a command.

## What the display means

- **Energy** is a game value, not a measurement of anyone's working hours or productivity.
- **Interactions** counts accepted visitor commands.
- **Build** reports the latest observed run of Whack-a-Bug's Pages workflow. The timestamp belongs to that run; this is a snapshot, not continuous monitoring.

The scheduled refresh and visitor commands update the build snapshot. No model call, paid API, tracking pixel, or personal access token is needed. The original robot is drawn with local SVG primitives.

## Development

```sh
node --test tests/*.test.mjs
```

The pure state transitions are in `scripts/buddy-core.mjs`, GitHub integration in `scripts/buddy.mjs`, and SVG rendering in `scripts/render-buddy.mjs`. The workflow separates repository-content updates from issue closure, and processes only the fixed command set.
