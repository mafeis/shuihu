import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const dependencies = [
	{
		name: "Naddy's Extra Controls",
		repository: "don-tnowe/godot-extra-controls",
		revision: "c95a3b79d11c89646345b6e892eda94bb310bae8",
		destination: "godot/addons/tnowe_extra_controls",
		license: "LICENSE.md",
		files: [
			"addons/tnowe_extra_controls/plugin.cfg",
			"addons/tnowe_extra_controls/elements/properties_box.gd",
			"addons/tnowe_extra_controls/elements/unfolded_option_button.gd",
		],
	},
	{
		name: "ProtonControlAnimation",
		repository: "HungryProton/proton_control_animation",
		revision: "13f3d20846d1799795f2d5390bd2307165bbf1ac",
		destination: "godot/addons/proton_control_animation",
		license: "LICENSE",
		files: [
			"addons/proton_control_animation/plugin.cfg",
			"addons/proton_control_animation/plugin.gd",
			"addons/proton_control_animation/src/animations/base_animation.gd",
			"addons/proton_control_animation/src/animations/fade.gd",
			"addons/proton_control_animation/src/animations/modulate.gd",
			"addons/proton_control_animation/src/animations/rotate.gd",
			"addons/proton_control_animation/src/animations/scale.gd",
			"addons/proton_control_animation/src/animations/size.gd",
			"addons/proton_control_animation/src/animations/slide.gd",
			"addons/proton_control_animation/src/metadata_updater.gd",
			"addons/proton_control_animation/src/proton_control_animation.gd",
			"addons/proton_control_animation/src/proton_control_copy_animation.gd",
		],
	},
];

for (const dependency of dependencies) {
	const response = await fetch(`https://api.github.com/repos/${dependency.repository}/git/trees/${dependency.revision}?recursive=1`);
	if (!response.ok) throw new Error(`${dependency.repository}: ${response.status} ${await response.text()}`);
	const tree = await response.json();
	const blobs = new Map(tree.tree.filter((entry) => entry.type === "blob").map((entry) => [entry.path, entry]));
	let lines = [dependency.repository, dependency.revision].join("\n");
	const downloads = [
		{ sourcePath: dependency.license, targetPath: join(dependency.destination, dependency.license) },
		...dependency.files.map((sourcePath) => ({
			sourcePath,
			targetPath: join(dependency.destination, sourcePath.replace(/^addons\/[^/]+\//, "")),
		})),
	];
	for (const { sourcePath, targetPath } of downloads) {
		const blob = blobs.get(sourcePath);
		if (!blob) throw new Error(`${dependency.repository}: missing ${sourcePath}`);
		const url = `https://raw.githubusercontent.com/${dependency.repository}/${dependency.revision}/${sourcePath}`;
		const download = await fetch(url);
		if (!download.ok) throw new Error(`${url}: ${download.status}`);
		const content = Buffer.from(await download.arrayBuffer());
		if (createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex") !== blob.sha) {
			throw new Error(`${sourcePath}: content hash does not match pinned revision`);
		}
		await mkdir(dirname(targetPath), { recursive: true });
		await writeFile(targetPath, content);
		lines += `\n${targetPath}\n${createHash("sha256").update(content).digest("hex")}`;
	}
	const upstreamPath = join(dependency.destination, "UPSTREAM.md");
	await mkdir(dirname(upstreamPath), { recursive: true });
	await writeFile(upstreamPath, `# Vendored UI component\n\n${lines}`);
	console.log(`${dependency.name}: ${downloads.length} files pinned at ${dependency.revision}`);
}
