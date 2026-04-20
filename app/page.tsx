import React from "react";

// Generated UI file — see `.agents/agents.md` for repository agent rules.
// Generation metadata (for audit):
// - Tool: automated assistant
// - Purpose: create a basic main landing page for the app
// - Minimal manual testing steps are in TESTING.md

export default function Home() {
	return (
		<main
			style={{
				maxWidth: 980,
				margin: "48px auto",
				padding: "0 20px",
				lineHeight: 1.5,
			}}
		>
			<header>
				<h1 style={{ fontSize: 36, margin: "0 0 8px" }}>Digital Media IMS</h1>
				<p style={{ margin: "0 0 20px", color: "#444" }}>
					Simple equipment tracking for classrooms — view inventory, check items
					in/out, and manage students.
				</p>
			</header>

			<nav aria-label="Primary navigation" style={{ marginBottom: 24 }}>
				<a
					href="/inventory"
					style={{
						display: "inline-block",
						marginRight: 12,
						padding: "8px 12px",
						background: "#0b5cff",
						color: "white",
						borderRadius: 6,
						textDecoration: "none",
					}}
				>
					View Inventory
				</a>
				<a
					href="/checkouts"
					style={{ display: "inline-block", padding: "8px 12px", color: "#0b5cff" }}
				>
					Checkouts
				</a>
			</nav>

			<section aria-labelledby="features">
				<h2 id="features" style={{ fontSize: 22, marginBottom: 8 }}>
					Key features
				</h2>
				<ul>
					<li>Inventory list with availability status</li>
					<li>Student checkout and check-in flow</li>
					<li>Supabase-backed auth and persistence (configurable via env)</li>
				</ul>
			</section>

			<section style={{ marginTop: 28 }}>
				<h3 style={{ fontSize: 18 }}>Getting started</h3>
				<ol>
					<li>Run the app locally: <code>npm run dev</code></li>
					<li>Open <code>http://localhost:3000</code> in a browser</li>
					  <li>Navigate to &quot;View Inventory&quot; to see inventory pages (placeholder)</li>
				</ol>
			</section>

			<footer style={{ marginTop: 40, color: "#666" }}>
				<small>
					This is a minimal starter landing page. See <a href="/TESTING.md">TESTING</a> for manual test steps
					and `.agents/agents.md` for agent rules.
				</small>
			</footer>
		</main>
	);
}
