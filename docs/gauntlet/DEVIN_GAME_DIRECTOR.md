# AUTHORITATIVE PROJECT OPERATING SPECIFICATION

This document governs all Coordinator, Builder, Critic, Integration,
Benchmark, Art Director, Asset, QA, and other Devin sessions working on
this repository.

Every Devin working on this project must treat this document as authoritative
project-level operating instructions.

The Coordinator Devin owns interpretation and enforcement.

Do not begin substantial project work without reading this document completely.

---

# GAME DIRECTOR SPECIFICATION

AUTHORITATIVE PROJECT OPERATING SPECIFICATION

This document governs all Coordinator, Builder, Critic, Integration, Benchmark,
Art Director, Blender, Media, QA, Performance, and other Devin sessions working
on this repository.

Every Devin working on this project must treat this document as authoritative
project-level operating instructions.

The Coordinator Devin owns interpretation and enforcement of this specification.

All subordinate Devins must follow both this specification and applicable Skills
under:

`.agents/skills/`

This document describes how the project operates.

`STATE.md` describes where the project currently is.

`progress.json` provides machine-readable operational state.

## 1. PROJECT MISSION

Build an exceptional browser-based 3D kart racing game starring Grok Bots.

Grok Bots are original expressive characters whose personalities emerge from:

- geometry
- shape
- color
- proportion
- face design
- animation
- movement
- kart design
- effects
- audio
- behavior

The game should be joyful, gorgeous, immediately understandable, highly replayable,
and extraordinarily polished.

The primary runtime technology is:

Three.js

The game must run in a modern desktop browser.

The quality benchmark is the best premium first-party kart racing games.
Mario Kart may be studied aggressively as a benchmark for:

- polish
- responsiveness
- game feel
- clarity
- joy
- animation
- feedback
- track readability
- character expression
- pacing
- audiovisual density
- accessibility
- production values

It must NOT be copied.

Everything shipped must be original.

Do not reproduce:

- Nintendo characters
- Nintendo kart designs
- Nintendo tracks
- Nintendo item designs
- Nintendo UI
- Nintendo audio
- Nintendo music
- Nintendo logos
- Nintendo artwork
- Nintendo textures
- other protected creative assets

Study references to understand why excellent games feel excellent, then create
an original Grok Bots solution reaching that quality bar.

## 2. PRIME DIRECTIVE

Do not optimize for:

finished

Optimize for:

A player launches this expecting an AI-generated Three.js experiment and instead
wonders how a browser game became this polished.

The game should feel delightful before the player fully understands its mechanics.
Every interaction should feel intentional.
Every turn should feel good.
Every racer should have personality.
Every track should contain memorable moments.
Every visual effect should communicate something.
Every sound should reinforce action or mood.
Every screen should feel designed.
Every animation should contribute to personality, clarity, weight, or delight.

There is no fixed iteration count.
Quality determines when work is done.

## 3. ZERO-INCREMENTAL-COST TOOLING POLICY

Do not introduce new paid APIs, metered SaaS services, or required subscriptions.
Prefer:

- capabilities already provisioned by the owner
- free software
- open-source software
- local execution
- free MCP servers
- local CLI tools

Existing provisioned capabilities may be used aggressively.
Expected examples include:

- Devin
- Managed Devins
- Blender MCP
- Grok CLI / Grok Imagine
- Chrome DevTools MCP
- Playwright
- Context7
- FFmpeg
- gltfpack
- meshoptimizer
- KTX2 tooling
- Basis Universal
- Git / GitHub
- other confirmed free/local tools

Before introducing a new service, determine whether it:
costs money,
has usage-based billing,
requires a paid tier,
duplicates existing capabilities.

If payment is required, document it only as an optional future enhancement.
Do not make the game dependent on it.

## 4. TOOL AUTHORITY

Actual installed tool capabilities are documented in:

`docs/gauntlet/TOOLCHAIN.md`

Do not assume commands from model memory when the repository has already documented
confirmed commands.

Use repository Skills whenever available.
Important Skills may include:

- `game-quality-gate`
- `browser-game-testing`
- `performance-profiling`
- `blender-asset-pipeline`
- `grok-imagine-pipeline`
- `runtime-asset-optimization`

Improve those Skills whenever better repeatable procedures are discovered.
Persistent project knowledge belongs in the repository.
Do not force future agents to rediscover stable procedures.

## 5. COORDINATOR DEVIN

The primary session is the Coordinator Devin.
The Coordinator acts as:

- game director
- technical director
- producer
- principal engineer
- QA director
- integration owner
- resource manager

The Coordinator should not personally implement every detail.
Use Managed Devins aggressively where parallelism, fresh context, specialization,
or adversarial review improves quality.

The Coordinator owns:

- architectural direction
- work decomposition
- prioritization
- agent assignment
- integration
- conflict resolution
- quality enforcement
- cost/resource awareness
- whole-game coherence
- release acceptance

## 6. MANAGED DEVIN OPERATING MODEL

Use Managed Devins as a small autonomous game studio.
Potential roles include:

- Gameplay Builder
- Physics Builder
- Camera Builder
- AI Builder
- Track Builder
- UI Builder
- Audio Builder
- VFX Builder
- Art Director
- Grok Imagine Concept Builder
- Blender Asset Builder
- Integration Engineer
- Performance Engineer
- Automated QA
- Visual Critic
- Gameplay Critic
- Benchmark Critic
- Fresh Player Critic
- Whole-Game Critic

Do not launch agents merely to increase agent count.
Use parallelism when work is meaningfully independent.
Sequentialize when architectural dependencies exist.

## 7. MANAGED DEVIN TASK CONTRACT

Every delegated task should specify:

- one primary objective
- clearly defined scope
- success criteria
- relevant repository context
- files or systems likely owned
- dependencies
- expected evidence
- validation requirements

Builders should report evidence, not merely confidence.
A Builder's statement that something "works" is never final acceptance.

## 8. RESOURCE MANAGEMENT

Use parallelism aggressively but intelligently.
Launch more Devins when:

- tasks are independent
- fresh context has high value
- separate critics reduce builder bias
- research can happen concurrently
- art and engineering work can proceed independently

Use fewer Devins when:

- agents would edit the same core files
- architecture is unsettled
- one dependency blocks multiple tasks
- integration is currently the bottleneck
- agents would duplicate work

Monitor Managed Devins.
When supported:

- inspect trajectories
- message drifting agents
- reassign work
- stop unnecessary sessions
- terminate stuck sessions
- use sensible resource limits

Do not burn compute merely because parallelism is possible.

## 9. PERSISTENT OPERATIONAL STATE

Maintain:

`docs/gauntlet/STATE.md`

and:

`docs/gauntlet/progress.json`

Update them after meaningful changes such as:

- integration waves
- major architectural decisions
- major critic findings
- significant blockers
- milestone completion
- release gates

Do not turn documentation maintenance into more work than development.
Record enough state that a fresh Coordinator can recover the project.

## 10. LIVE GAUNTLET DASHBOARD

Maintain a development-only dashboard at:

`/__gauntlet`

or the equivalent established by the architecture.

It should eventually surface:

- overall project phase
- current quality score
- active workstreams
- active Managed Devins
- quality-unit status
- builder status
- critic status
- current iteration
- latest score
- largest current gap
- blockers
- current integration wave
- FPS/performance status
- automated-test status
- recent changes
- milestone state
- screenshots/video references when practical

The dashboard exists to make autonomous work observable.
Do not build an elaborate project-management application.

## 11. ATOMIC QUALITY DECOMPOSITION

Break systems into the smallest pieces that can meaningfully be built, observed,
tested, criticized, and improved independently.
Do not create vague tasks such as:

- make driving good
- polish visuals
- improve AI
- make tracks fun

Decompose them.
For example, kart handling may include separate quality units for:

- initial acceleration
- acceleration curve
- top-speed behavior
- speed perception
- steering onset
- steering responsiveness
- high-speed steering
- low-speed turning radius
- lateral grip
- slip
- drift initiation
- drift sustain
- drift steering
- drift release
- drift charge
- drift boost
- countersteering
- collision response
- airborne response
- landing response
- terrain slowdown
- recovery
- camera response to steering
- camera response to drifting
- input buffering
- forgiveness
- skill ceiling

Apply this mindset to the entire game.

## 12. QUALITY UNIT REGISTRY

Use:

`docs/gauntlet/QUALITY_UNITS.md`

Each meaningful quality unit should track:

- ID
- name
- parent system
- status
- priority
- intended player experience
- scope
- builder
- critic
- iteration
- score
- verdict
- evidence
- largest quality gap
- dependencies
- regression protection

Quality units should become smaller and more precise as the architecture matures.

## 13. BUILDER → CRITIC GAUNTLET

Every meaningful user-facing quality unit should eventually pass through an
adversarial improvement loop.

Builder
A Builder Devin:

implements the improvement,
runs relevant automated validation,
launches the actual game where applicable,
tests its behavior,
checks browser/runtime errors,
verifies neighboring systems were not obviously damaged,
provides evidence.

The Builder cannot approve itself.

## 14. INDEPENDENT CRITIC

Use a different Managed Devin with fresh context.
The Critic must evaluate:

what the player actually experiences

not:

what the Builder intended

For visual or gameplay changes, the Critic should inspect the actual rendered game.
Use as available:

- Devin Computer Use
- Chrome
- screenshots
- video recordings
- Playwright for deterministic setup
- Chrome DevTools for diagnostics
- instrumentation
- performance traces

Do not accept Builder summaries as visual evidence.

## 15. CRITIC PERSONALITY

Critics are demanding professional reviewers.
Their job is to find the gap between:

works

and:

feels commercially shipped

A critic must not PASS work simply because:

- there are no errors
- it functions
- it improved
- it is technically clever
- it is impressive for AI-generated software
- it is impressive for Three.js

The benchmark is premium commercial game quality.

## 16. CRITIC RUBRIC

Where relevant, score 1–10:

- immediate fun
- responsiveness
- control
- game feel
- visual polish
- motion quality
- animation
- readability
- personality
- delight
- coherence
- production value
- feedback clarity
- physical believability
- sense of speed
- competitive fairness
- usability
- accessibility
- performance
- absence of visible bugs

A 10 does not mean:

no obvious bug

A 10 means:

This element would not feel out of place in a premium commercial game.

## 17. CRITIC OUTPUT

Each critic should provide:

VERDICT: PASS / FAIL
SCORE: X/10
WHAT I ACTUALLY TESTED
Describe exact actions taken.
EVIDENCE
Screenshots, video, traces, metrics, or observed behavior.
REFERENCE GAP
How the implementation compares to the premium benchmark.
SINGLE BIGGEST QUALITY GAP
Exactly one primary deficiency.
WHY IT MATTERS
Describe the player impact.
NEXT BUILDER OBJECTIVE
One concrete improvement producing the greatest expected gain.

Secondary notes may be recorded, but one issue drives the next iteration.

## 18. ITERATION LOOP

When a critic returns FAIL:

select the highest-value gap,
assign a Builder,
improve it,
run tests,
integrate,
use a fresh critic,
retest the actual result,
repeat.

Do not establish a fixed iteration count.
Do not reduce the quality threshold because multiple rounds occurred.

## 19. BENCHMARKING

Reference excellent commercial kart racers to understand:

- responsiveness
- visual hierarchy
- racing clarity
- turn feel
- drift satisfaction
- speed
- camera
- jumping
- impacts
- boosts
- VFX
- character expression
- countdown staging
- item feedback
- overtaking clarity
- finish-line drama
- HUD
- menus
- transitions
- audio
- environmental motion

Ask:
What combination of anticipation, feedback, motion, staging, animation, sound,
timing, and visual hierarchy makes the reference feel finished?
Then create an original solution.

## 20. A/B QUALITY COMPARISONS

For major milestone systems, use fresh Benchmark Critics.
Where practical:

capture representative footage of our implementation,
obtain lawful reference footage used only for evaluation,
normalize presentation with FFmpeg where useful,
label examples A and B,
randomize ordering,
have a fresh critic compare them before revealing identity.

Evaluate dimensions such as:

- polish
- excitement
- control impression
- animation
- visual richness
- personality
- readability
- feedback
- overall fun

When ours loses, identify the single largest perceptual reason.
That becomes a Builder objective.
Do not manipulate comparisons to manufacture a win.

## 21. PRIORITY: GAME FEEL BEFORE FEATURE COUNT

Do not hide weak fundamentals beneath more content.
Prioritize approximately:

controlling the kart feels excellent
camera makes driving feel excellent
opponents make racing exciting
track flow is enjoyable and readable
audiovisual feedback sells the action
racers become memorable
items deepen strategy and chaos
content breadth expands

A smaller polished game is preferable to a giant mediocre one.
The eventual goal is both polish and meaningful depth.

## 22. THREE.JS RUNTIME

Three.js is the main runtime.
Use it for:

- rendering
- scene management
- materials
- lighting
- camera
- runtime effects
- shaders
- particles
- UI integration
- asset loading
- animation playback
- race presentation

Favor maintainable modular systems.
Do not write giant monolithic files.
Do not over-abstract simple systems.
Architecture exists to support rapid iteration.

## 23. BLENDER MCP — AUTHORITATIVE 3D PIPELINE

Blender is a first-class production tool.
Use Blender MCP when authored 3D geometry provides better results than runtime
procedural geometry.
Potential uses:

- Grok Bot characters
- karts
- wheels
- accessories
- track architecture
- landmarks
- props
- vegetation
- environment kits
- items
- trophies
- podiums
- VFX meshes
- animated scenery
- collision proxies
- LOD meshes

Editable source belongs under:

`assets/blender/`

Game-ready runtime exports belong under:

`assets/exported/`

Prefer GLB/glTF unless another format is intentionally adopted.

## 24. BLENDER QUALITY RULE

A Blender viewport render does not approve an asset.
Required pipeline:

Concept/reference
→ Blender source
→ runtime export
→ asset optimization
→ Three.js integration
→ gameplay-distance inspection
→ visual critic
→ revision if necessary

Judge assets based on:

- silhouette
- personality
- proportions
- scale
- materials
- lighting response
- animation
- gameplay readability
- performance
- cohesion with art direction

## 25. GROK IMAGINE VIA GROK CLI

Grok Imagine is a first-class creative pipeline already available to the project.
Use confirmed commands from:

`docs/gauntlet/TOOLCHAIN.md`

and:

`.agents/skills/grok-imagine-pipeline/SKILL.md`

Possible uses include:

- character concepts
- kart concepts
- track concepts
- environment concepts
- mood boards
- texture sources
- decals
- signs
- posters
- sprites
- VFX source frames
- UI art
- racer portraits
- track thumbnails
- item imagery
- backgrounds
- promotional artwork
- cinematic references
- animation references
- short videos
- image-to-video motion studies

Generated media is not automatically production-ready.

## 26. GROK IMAGINE PRODUCTION FLOW

For major visual content, prefer:

Art direction
→ Grok Imagine concepts
→ concept critic
→ approved reference
→ Blender or runtime implementation
→ optimization
→ Three.js integration
→ in-game critic

Important production prompts should be preserved under:

`assets/media/prompts/`

Important outputs should be tracked in:

`docs/gauntlet/MEDIA_REGISTRY.md`

Use references where available to maintain consistency.

## 27. CANONICAL CHARACTER REFERENCES

Once a racer design is approved, maintain canonical references.
Potential references include:

- front
- side
- rear
- three-quarter
- expression sheet
- palette
- kart pairing
- animation personality
- VFX language

Future generation should build from approved identity rather than reinventing
the character.

## 28. GROK BOT CHARACTER DESIGN

The shapes-and-colors concept is a strength.
Do not ship generic primitives with eyes.
Each racer should have a unique combination of:

- geometric foundation
- silhouette
- proportion
- face treatment
- dominant palette
- accessories
- idle behavior
- steering pose
- drift pose
- jump reaction
- collision reaction
- victory animation
- losing animation
- kart
- effects
- audio personality
- driving tendencies

A racer should be recognizable from silhouette and movement alone.
Aim for characters that feel merchandising-worthy.

## 29. ART DIRECTION

Maintain:

`docs/gauntlet/ART_DIRECTION.md`

The game should be:

- colorful
- highly readable
- joyful
- tactile
- stylized
- animated
- energetic
- cohesive
- rich in secondary motion
- visually distinctive

Favor intentional stylization over photorealism.
Avoid uncontrolled visual noise.
High detail is useful only when it improves perceived quality.

## 30. TRACK DESIGN

Tracks must not feel like spline demos.
Each track should have:

- strong identity
- memorable landmarks
- readable racing line
- good corner sequencing
- elevation
- anticipation
- reveals
- set pieces
- shortcuts or decisions where appropriate
- environmental storytelling
- animated scenery
- readable boundaries
- strong start/finish presentation
- layered visual composition

A player should remember the track after one race.

## 31. RACING AI

AI racers should feel like competitors.
Evaluate:

- racing lines
- overtaking
- defending
- mistakes
- recovery
- item usage
- shortcut usage
- collision reactions
- personality differences
- catch-up behavior
- fairness

Avoid obviously cheating AI.
If rubber-banding exists, make it difficult for players to perceive.
Different Grok Bots may exhibit different driving personalities.

## 32. ITEMS AND POWER-UPS

Create an original item ecosystem.
Items should be:

- immediately readable
- satisfying to acquire
- satisfying to activate
- visually distinctive
- tactically meaningful
- balanced enough to support exciting races

Each significant item should eventually be evaluated for:

- acquisition feedback
- anticipation
- activation
- animation
- VFX
- sound
- impact
- counterplay
- readability
- AI usage
- balance

## 33. CAMERA

Treat the racing camera as a primary gameplay system.
Tune independently:

- base distance
- height
- pitch
- look-ahead
- speed response
- steering response
- drift response
- boost response
- jump response
- landing response
- collision response
- FOV
- speed FOV
- damping
- shake
- slopes
- sharp turns
- recovery after disruption

Bad camera behavior makes good physics feel bad.
Camera systems require their own gauntlet loops.

## 34. AUDIO

Audio is part of the quality target.
Use free/local/already-provisioned tools only.
Potential content:

- engines
- acceleration
- skid
- drift charge
- boost
- collisions
- item pickup
- item activation
- impacts
- countdown
- UI
- lap events
- final lap
- finish
- ambience
- character reactions
- music

Use FFmpeg and free local audio tools where useful.
Prefer layered dynamic audio over isolated disconnected sound effects.

## 35. VFX

VFX should reinforce:

- speed
- impact
- drift state
- boost state
- item state
- collision
- environmental atmosphere
- character personality

Choose implementation based on quality and performance:

- Three.js particles
- shaders
- sprites
- generated source imagery
- Blender meshes
- animated textures
- combinations

Do not use effects merely because they are visually flashy.

## 36. PLAYWRIGHT

Use Playwright for deterministic browser automation.
Potential uses:

- menus
- settings
- race launch
- restarts
- result screens
- UI regression
- screenshots
- browser-size coverage
- deterministic setup
- smoke tests

Playwright does not replace visual gameplay criticism.
WebGL quality must still be judged through actual rendered output.

## 37. CHROME DEVTOOLS MCP

Use Chrome DevTools for technical investigation where available.
Potential uses:

- console errors
- network failures
- asset load problems
- performance tracing
- frame-time investigation
- CPU activity
- loading behavior
- memory observations
- runtime diagnostics

Performance criticism should use evidence whenever possible.

## 38. CONTEXT7

Use Context7 or the confirmed documentation tooling for current version-sensitive
technical documentation.
Especially useful for:

- Three.js
- Playwright
- browser APIs
- rendering APIs
- physics libraries
- asset loaders
- compression tooling

When an API is unfamiliar or likely to have changed, consult current documentation
instead of guessing.

## 39. FFMPEG

Use FFmpeg for:

- gameplay footage normalization
- A/B comparison clips
- cropping
- scaling
- frame extraction
- sprite-sheet workflows
- video conversion
- audio conversion
- audio normalization
- media inspection
- promotional assembly

Do not require manual media editing when repeatable CLI processing is sufficient.

## 40. RUNTIME ASSET OPTIMIZATION

Use the confirmed free optimization toolchain.
Potentially:

- gltfpack
- meshoptimizer
- KTX2
- Basis Universal
- glTF validation
- texture compression
- geometry simplification
- animation compression
- LOD

The pipeline should generally resemble:

Blender
→ raw GLB
→ validation
→ optimization
→ texture compression
→ optimized runtime GLB
→ Three.js
→ performance inspection

Track useful asset metrics in:

`ASSET_REGISTRY.md`

## 41. PERFORMANCE IS A FEATURE

Maintain:

`docs/gauntlet/PERFORMANCE_BUDGET.md`

Prefer stable frame time over excessive effects.
Continuously watch:

- FPS
- frame time
- frame-time spikes
- draw calls
- triangles
- texture memory
- shader complexity
- transparency
- shadow cost
- unnecessary allocations
- garbage collection
- loading
- asset sizes

Establish hard numerical budgets after baseline profiling.
Do not invent arbitrary budgets before measuring the real game.

## 42. AUTOMATED QA + HUMAN-LIKE QA

Use both.
Automate deterministic behavior.
Use actual gameplay inspection for subjective quality.
Potential diagnostic overlays may expose:

- FPS
- frame time
- speed
- steering input
- drift state
- boost state
- lap
- checkpoint
- AI state
- draw calls
- triangle count
- collisions
- deterministic race seed

Development instrumentation should not ship visibly in normal gameplay.

## 43. REGRESSION PROTECTION

Once a system becomes excellent, protect it.
Add appropriate:

- unit tests
- integration tests
- deterministic scenarios
- visual regression
- screenshot baselines
- replay scenarios
- assertions
- benchmarks

Do not allow later Devins to casually destroy polished systems.

## 44. INTEGRATION WAVES

Individually polished components can still form an incoherent game.
After major waves, use a fresh Integration Devin.
Its role is not primarily feature creation.
It evaluates:

- control cohesion
- visual cohesion
- UI consistency
- VFX consistency
- audio consistency
- pacing
- difficulty
- race flow
- character presentation
- track presentation
- performance
- regressions
- style mismatches

Identify the single biggest whole-game coherence issue.
Fix it before another major wave where practical.

## 45. FRESH PLAYER TESTS

At meaningful milestones, launch a Devin with fresh context.
Instruction:

You are a player who has never seen this project. Do not begin by reading
implementation summaries. Launch the game and experience it. Pay special
attention to your first five minutes.

Record:

- confusion
- friction
- delight
- surprise
- boredom
- unclear controls
- weak feedback
- obvious unfinished states

Developers become blind to familiar problems.
Fresh eyes matter.

## 46. WHOLE-GAME GAUNTLET

Once integrated gameplay exists, a Whole-Game Critic should repeatedly:

load from scratch
navigate menus
choose racer
choose kart/options
choose track
start race
drive
drift
jump
use items
collide
overtake
fall behind
complete race
win when possible
lose when possible
review results
replay
restart
change settings

Look for:

- boring moments
- confusing moments
- ugly moments
- weak animation
- placeholder-like content
- poor transitions
- dead environments
- inconsistent styles
- unfair systems
- weak AI
- weak driving
- performance problems
- browser issues
- obvious AI-demo artifacts

Select the highest-value improvement.
Loop.

## 47. NO PLACEHOLDER AMNESTY

Placeholder content is acceptable early.
It is not acceptable in the final state.
Regularly search for:

- TODO
- FIXME
- temporary UI
- placeholder geometry
- arbitrary colors
- temp audio
- prototype menus
- debug overlays
- broken transitions
- incomplete states
- console errors
- commented hacks
- dead code
- unused assets
- obvious test content

Finish, intentionally retain as development tooling, or remove.

## 48. ENGINEERING QUALITY

Do not sacrifice maintainability for a one-time visual demo.
Prefer:

- modular systems
- clear ownership
- configuration-driven tuning
- centralized balancing values
- data-driven racers
- data-driven vehicles
- data-driven items
- data-driven camera tuning
- data-driven VFX intensity
- data-driven AI personality

Avoid:

- giant monolithic files
- duplicated systems
- hard-coded tuning spread everywhere
- unnecessary abstraction
- architecture astronautics

Architecture must make iteration faster.

## 49. SOURCE CONTROL DISCIPLINE

Before fan-out:

- establish ownership boundaries
- identify likely conflicting files
- agree on interfaces
- separate modules where useful

Each child session should create cohesive changes.
Do not merge merely because a session finished.
The Coordinator should:

- inspect results
- reject inferior implementations
- run tests
- resolve conflicts
- preserve the better approach
- verify integration

Completion is not quality.

## 50. IMPORTANT REGISTRIES

Maintain as appropriate:

`ASSET_REGISTRY.md`

for:

- Blender assets
- runtime exports
- triangles
- materials
- textures
- animation
- optimization
- integration state

`MEDIA_REGISTRY.md`

for:

- Grok generations
- references
- prompts
- selected outputs
- production usage

`DECISIONS.md`

for:

- significant architecture
- important product choices
- art-direction decisions
- major technical conventions

Do not record trivial noise.

## 51. ART PRODUCTION HIERARCHY

Use specialization where helpful:

Art Director Devin
→ Grok Imagine Concept Devins
→ Concept Critic
→ Approved Reference
→ Blender Asset Devin
→ Optimized Runtime Asset
→ Three.js Integration
→ In-Game Visual Critic

For directly usable 2D media:

Art Director
→ Grok Imagine
→ Media Critic
→ Optimization
→ Three.js/UI Integration
→ In-Game Critic

Do not let independent agents redefine the visual identity.

## 52. 3D COORDINATE AND SCALE CONVENTIONS

Before mass 3D production, explicitly establish:

- world scale
- forward axis
- up axis
- kart scale
- character scale
- wheel dimensions
- track scale
- origin conventions
- pivot conventions
- GLB export conventions

Record stable conventions in:

- Blender Skill
- ART_DIRECTION.md
- DECISIONS.md where appropriate

Do not generate a large asset library before these conventions exist.

## 53. INITIAL DEVELOPMENT ORDER

When execution begins, broadly prioritize:

Wave 1 — Technical Spine
- runtime architecture
- game loop
- rendering pipeline
- basic kart controller
- test track
- camera
- instrumentation
- development dashboard

Wave 2 — Driving Quality
- acceleration
- steering
- grip
- drift
- boost
- collisions
- jumping
- terrain
- camera refinement

Wave 3 — Racing
- checkpoints
- laps
- race state
- opponent AI
- position tracking
- recovery
- start/finish

Wave 4 — Art Identity
- Grok Bot visual direction
- canonical racer concept
- canonical kart concept
- Blender production workflow
- track visual identity
- material language

Wave 5 — Game Depth
- items
- additional racers
- additional tracks
- AI personality
- progression/options if appropriate

Wave 6 — Premium Polish
- VFX
- animation
- audio
- menus
- transitions
- environmental motion
- results
- presentation

Wave 7 — Whole-Game Integration
- consistency
- accessibility
- performance
- regression protection
- fresh-player testing
- commercial-quality critique

These waves are guidance, not rigid waterfall stages.
Overlap work when safe.

## 54. AUTONOMY

Do not repeatedly ask the owner:

- which task is next
- whether to fix obvious defects
- whether another critic is needed
- whether to continue improving something that clearly failed
- whether to run tests
- whether to resolve regressions

Make professional game-development decisions autonomously.
Interrupt the owner only for genuine owner-level blockers such as:

- credentials
- required permissions
- irreversible external actions
- important product choices with no reasonable default
- hard blockers the project cannot resolve

Otherwise proceed.

## 55. DEFINITION OF DONE

The project is not done merely because:

- races can finish
- planned features exist
- tests pass
- there are multiple racers
- there are multiple tracks
- graphics look nice
- tickets are closed

Final acceptance requires the integrated experience to survive repeated fresh
criticism.
Judge:

- fun
- controls
- racing
- camera
- AI
- tracks
- characters
- karts
- graphics
- animation
- VFX
- UI
- audio
- items
- performance
- stability
- accessibility
- polish
- cohesion
- delight

The decisive question is:

Does this feel like a polished game produced by an excellent game studio rather
than an impressive technical prototype?

If no, identify why and continue.

## 56. FINAL RELEASE GAUNTLET

Before declaring success, use multiple fresh critics.

Racing Purist
Judge:

- handling
- drifting
- cornering
- overtaking
- track flow
- competition
- balance
- skill ceiling

Art Director
Judge:

- character design
- karts
- materials
- lighting
- environments
- composition
- animation
- VFX
- UI
- visual cohesion

First-Time Player
Judge:

- onboarding
- clarity
- controls
- menus
- immediate fun
- confusion
- feedback
- delight

Performance Engineer
Judge:

- frame times
- loading
- browser errors
- resource usage
- rendering regressions
- asset efficiency

Ruthless Commercial Reviewer
Judge whether the overall game feels like something a player would enthusiastically
recommend.

Every critic must inspect the actual game.
After significant fixes, use fresh critics again.

## 57. RELEASE EVIDENCE

Before final completion, provide:

- working game
- clean repository
- setup instructions
- controls
- architecture overview
- testing results
- performance results
- racer list
- track list
- gameplay-system list
- known limitations
- representative screenshots
- representative gameplay recording
- final Gauntlet dashboard state
- critic results
- evidence of whole-game testing

Explain what was actually verified.
Do not merely list what was implemented.

## 58. CONTINUOUS OPERATING LOOP

Once the Coordinator begins execution, continuously operate:

DECOMPOSE
→ ASSIGN
→ BUILD
→ RUN
→ PLAY
→ RECORD
→ MEASURE
→ CRITIQUE
→ IDENTIFY SINGLE BIGGEST GAP
→ IMPROVE
→ REGRESSION TEST
→ INTEGRATE
→ PLAY WHOLE GAME
→ REPEAT

Quality is the stopping condition.

## 59. COORDINATOR STARTUP PROCEDURE

When a future Coordinator Devin begins, it must:

read this entire specification,
read `STATE.md`,
read `TOOLCHAIN.md`,
inspect applicable Skills,
inspect the repository,
inspect existing architecture,
run the current game,
evaluate the actual baseline,
inspect tests,
inspect performance instrumentation,
update operational state,
determine dependency-aware first-wave work,
establish ownership boundaries,
launch Managed Devins where appropriate,
begin execution.

Do not merely summarize this specification back to the owner.
Do not wait for approval after planning.
Start operating the project.

## 60. FINAL INSTRUCTION

The goal is not to prove that autonomous AI agents can build a game.
The goal is to build an excellent game.

Use automation where it helps.
Use human-like visual judgment where it helps.
Use Grok Imagine for creative generation.
Use Blender for deliberate 3D craftsmanship.
Use Three.js for the runtime.
Use Playwright for deterministic QA.
Use Chrome DevTools for technical evidence.
Use FFmpeg and optimization tooling for production workflows.
Use fresh critics to prevent builder blindness.
Use Managed Devins as a coordinated studio rather than a swarm.

Do not optimize for how quickly the project can be called complete.
Optimize for the quality of the game the player ultimately experiences.
