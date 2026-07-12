Perfect. Here’s a clean, structured DEVLOG snapshot (A4) covering everything we’ve built and changed so far in Sailing Whiteboard.

You can paste this into DEVLOG.md in the repo.

⸻

Sailing Whiteboard – Development Log Snapshot

🎯 Core Vision

Sailing Whiteboard is designed to:
	•	Replay and explain what happened on the water
	•	Enable casual storytelling (e.g., in the bar)
	•	Support structured protest-room replays
	•	Provide animated step-based scenarios
	•	Be intuitive for first-time users

Primary interaction model:
	•	Discrete Steps system (not continuous keyframes)
	•	Timeline-driven animation
	•	Canvas-first editing
	•	Scenario-based onboarding

⸻

✅ Major Architecture Changes

1️⃣ Step-Based Animation System

Replaced keyframe timeline model with:

StepsByBoatId: {
  [boatId]: Step[]
}

Each Step:

{
  id: string
  tMs: number
  x: number
  y: number
  headingMode: "auto" | "manual"
  headingDeg?: number
}

Behavior:
	•	Steps sorted by time
	•	Interpolation between steps
	•	Ghost boats rendered at each step
	•	Optional ripple when dragging earlier steps
	•	Slider-driven step repositioning
	•	Prevent crossing logic (strict monotonic timeline)

⸻

2️⃣ Canvas Rendering Refactor

Moved rendering into:

builder/useCanvasDraw.ts

Layers:
	1.	Grid
	2.	Wind (always drawn)
	3.	Start line (toggle)
	4.	Marks (toggle)
	5.	3BL circle (optional)
	6.	Track lines (dashed)
	7.	Ghost boats
	8.	Current boats
	9.	Flags overlay
	10.	Time indicator

⸻

3️⃣ Canvas Interaction Hook

Moved pointer logic into:

builder/useCanvasInteractions.ts

Supports:
	•	Drag boats
	•	Rotate boats
	•	Drag marks
	•	Drag start line ends
	•	Drag flags
	•	Snap-to-grid
	•	Pause playback on interaction

Bug fixed:
	•	Selection ping-pong between flags and boats

⸻

4️⃣ Overlays & Visual Tools

✅ 3 Boat Length Circle (Optional)
	•	Drawn from mark center (not edge)
	•	Controlled via CoursePanel toggle

✅ Transom Overlap Line
	•	Perpendicular to stern
	•	Optional toggle
	•	Drawn in boat local coords

⸻

5️⃣ Full Screen Layout Refactor
	•	Canvas now expands full screen
	•	AudioScrubberBar width matches canvas
	•	Timeline separated from scrubber
	•	Right sidebar collapsible
	•	Collapse replaced with custom sidebar

⸻

6️⃣ StepsDopeSheet Redesign

Major redesign:

Old:
	•	One lane per boat
	•	Chips + slider per lane
	•	Grew vertically uncontrollably

New:
	•	Left nav (Boats / Flags)
	•	Focused single-lane editor
	•	Slider-only step UI
	•	Chips replaced by thumb numbers

Improvements:
	•	Ripple behavior fixed
	•	Strict monotonic enforcement
	•	No slider crossing
	•	Better handle detection
	•	Selection behavior corrected

⸻

7️⃣ Welcome Overlay

File:

builder/WelcomeOverlay.tsx

Features:
	•	Intro explanation
	•	“How it works” section
	•	Scenario picker
	•	Don’t show again (localStorage)
	•	Skip to blank
	•	Sticky close

Controlled by:

swb_welcome_hide


⸻

8️⃣ Scenario System

File:

builder/scenarios.ts

ScenarioKey:

type ScenarioKey =
  | "start-sequence"
  | "boat-interaction"
  | "protest-replay"
  | "five-boat-start-rack"
  | "blank"

Loader:

getScenarioProjectFile(key)

Scenarios reuse import pipeline via useProjectIO.

⸻

🚩 Five Boat Start Rack Scenario

Spec Implemented:
	•	Duration: 120s
	•	Gun at 60s
	•	Wind: 0° @ 15kt
	•	Double-length start line
	•	Line moved higher on canvas
	•	Boats on starboard tack (45° off line)
	•	5 boats
	•	Rack movement in final 10s
	•	Sail up course for 20s after start

Flags:
	•	Class flag up at 10s
	•	P up at 20s
	•	P down at 50s
	•	Orange displayed full time

⸻

🔁 Import / Export

Hook:

useProjectIO.ts

Handles:
	•	Export JSON
	•	Import JSON
	•	Scenario loading
	•	Back-compat with old flagVisibilityById

Important fix:
	•	Scenario loader must call loadProject(project) instead of importProject(JSON.stringify(project))

⸻

🖥 UI Improvements

Timeline Nav
	•	Limit nav height to 3 items
	•	Scrollable list
	•	Sticky Boats/Flags selector

Canvas
	•	Always full width
	•	Scrubber detached from dope sheet

⸻

🐛 Major Bugs Fixed
	•	Slider ripple failing when crossing
	•	Step jiggle without move
	•	Selection loop between boats/flags
	•	Flag clip typing mismatch
	•	ScenarioKey type mismatch between duplicate src folders
	•	FlagCode enum mismatch (“Class” → use valid FlagCode)

⸻

🧠 Product Positioning Insight

Market includes:
	•	Casual storytelling
	•	Coaching
	•	Sailing schools
	•	Protest rooms

Not neurodiverse thinking — it’s strong product empathy for visual replay needs.

⸻

🔜 Next Big Work Items

1️⃣ Pan / Zoom System (In Progress)

Goals:
	•	Desktop:
	•	Mouse wheel zoom
	•	Click + drag pan
	•	Mobile:
	•	Pinch zoom
	•	Two-finger pan

Needs:
	•	World coordinate transform
	•	Scale + translate state
	•	Convert pointer coords → world coords
	•	Clamp zoom bounds
	•	Optional “reset view” button

⸻

2️⃣ Mobile Layout

Current problem:
	•	Canvas not visible
	•	Timeline too large
	•	Sidebar not mobile-aware

Plan:
	•	Canvas top
	•	Scrubber under
	•	Collapsible timeline
	•	Bottom sheet inspector

⸻

📦 Current State Summary

Area	Status
Step animation	Stable
Slider behavior	Stable
Ghost boats	Working
Flags + clips	Working
Scenario loader	Working
Welcome overlay	Working
Start rack scenario	Implemented
Pan / Zoom	Not implemented
Mobile layout	Not implemented


⸻

🔒 Architectural Notes
	•	Steps are canonical source of truth.
	•	Rendering is stateless (pure draw).
	•	Interaction uses refs to prevent stale closure bugs.
	•	Timeline and scenario loading use unified import pipeline.
	•	All IDs generated at runtime to avoid collision.

⸻

If you’d like, I can now generate:
	•	A clean Git commit message set
	•	A roadmap.md
	•	A Pan/Zoom implementation blueprint
	•	Or move straight into building the pan/zoom system properly.