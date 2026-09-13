# Quality Units Registry

A **quality unit** is the smallest independently buildable, testable, and
critic-reviewable piece of the game. Builders implement units; Critics verify
them in the actual running game; the Coordinator sequences them into waves.

Full decomposition happens **after** the Coordinator establishes the runtime
architecture and baseline — do not decompose prematurely.

## Unit Template

```markdown
### <unit-id> — <name>

- **Domain:** <one of the domains below>
- **Status:** Planned | In Progress | Built | In Review | Accepted | Blocked
- **Builder:** <session/agent>
- **Critic:** <session/agent>
- **Dependencies:** <unit-ids>
- **Wave:** <n>
- **Spec:** <what "done" means, observable in-game>
- **Evidence:** <screenshots/clips/traces proving it>
- **Critic Result:** <score + notes>
- **Largest Gap:** <single most important remaining deficiency>
```

## Domains

Decomposition targets (not yet broken down):

- Core architecture
- Rendering
- Kart movement
- Acceleration
- Steering
- Grip
- Drifting
- Boosting
- Jumping
- Collision response
- Terrain response
- Camera
- Race rules
- Checkpoints
- Lap logic
- Starting sequence
- Finish sequence
- AI racers
- AI personality
- Overtaking
- Recovery
- Track design
- Track readability
- Track landmarks
- Shortcuts
- Characters
- Karts
- Character animation
- Kart animation
- VFX
- Lighting
- Materials
- Environment art
- Items
- Item balancing
- HUD
- Menus
- Transitions
- Audio
- Music
- Input
- Accessibility
- Performance
- Loading
- Automated QA
- Visual regression
- Whole-game cohesion

---

*No units decomposed yet — awaiting Coordinator baseline.*
