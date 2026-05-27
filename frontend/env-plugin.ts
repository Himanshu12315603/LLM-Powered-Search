import type { BunPlugin } from "bun";

const envPlugin: BunPlugin = {
  name: "env-transformer",
  setup(build) {
    build.onLoad({ filter: /\.(ts|tsx)$/ }, async (args) => {
      if (args.path.includes("node_modules")) return;

      const code = await Bun.file(args.path).text();
      if (!code.includes("import.meta.env")) return;

      const contents = code.replaceAll("import.meta.env", "process.env");
      const extension = args.path.split(".").pop();
      const loader = extension === "tsx" ? "tsx" : "ts";

      return {
        contents,
        loader,
      };
    });
  },
};

export default envPlugin;
