import js from "@eslint/js";
import globals from "globals";
import eslintPluginImport from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      import: eslintPluginImport,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
      "import/internal-regex": "^@/features/",
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        {
          allowConstantExport: true,
          allowExportNames: [
            "badgeVariants",
            "buttonVariants",
            "navigationMenuTriggerStyle",
            "toast",
            "toggleVariants",
            "useFormField",
            "useReadOnly",
            "useSidebar",
            "useUserPermissions",
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/features/*",
              from: "./src/features/*",
              except: [
                "./index",
                "./routes",
                "./components/**",
                "./hooks/**",
              ],
              message: "Features may depend only on shared/, entities/, or their own public API.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "import/no-internal-modules": [
        "error",
        {
          allow: [
            "./**",
            "../**",
            "components/**",
            "hooks/**",
            "../hooks/**",
            "@/features/*/index",
            "@/features/*/routes",
            "@/shared/**",
            "@/entities/**",
            "@/hooks/**",
            "@/app/**",
            "@hookform/**",
          ],
        },
      ],
    },
  },
);
