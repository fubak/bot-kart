# Test Matrix

Testing categories for the project. No results exist yet — this defines what
*will* be exercised, not what has passed.

## Automated

- [ ] build (`npm run build`)
- [ ] lint (TBD — no linter configured yet)
- [ ] type checking (`npm run typecheck`)
- [ ] unit tests (TBD — no test runner configured yet)
- [ ] integration tests
- [ ] browser launch
- [ ] menu navigation
- [ ] race start
- [ ] race restart
- [ ] settings
- [ ] results flow
- [ ] deterministic scenarios (requires seeded RNG — future architecture)
- [ ] asset loading
- [ ] console-error detection

## Visual

- [ ] screenshots (playwright-cli `screenshot`, chrome-devtools `take_screenshot`)
- [ ] dynamic gameplay recordings (playwright-cli `video-start`/`video-stop`)
- [ ] track views
- [ ] HUD states
- [ ] character presentation
- [ ] VFX
- [ ] responsive resolution tests (playwright-cli `resize`, chrome-devtools `emulate` viewport)

## Gameplay

- [ ] acceleration
- [ ] steering
- [ ] drifting
- [ ] boosts
- [ ] jumps
- [ ] collisions
- [ ] item behavior
- [ ] AI competition
- [ ] lap logic
- [ ] finish logic

## Performance

- [ ] FPS
- [ ] frame time (avg + 1% lows)
- [ ] load time
- [ ] network / asset transfer
- [ ] draw calls
- [ ] geometry (triangles)
- [ ] memory (heap, GPU)
- [ ] performance traces (chrome-devtools `performance_*_trace`)

## Whole Game

- [ ] fresh-player test
- [ ] full race
- [ ] win
- [ ] loss
- [ ] replay
- [ ] settings
- [ ] alternate racer
- [ ] alternate track
- [ ] restart
