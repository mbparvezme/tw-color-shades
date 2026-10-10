#!/usr/bin/env node
/**
 * `twcs` is a short alias so `npx twcs <color>` works without installing
 * anything, which a bin alias inside tw-color-shades cannot do: npx resolves
 * a bare name to a package, not to a binary.
 *
 * Importing the CLI runs it. process.argv is already correct, because the CLI
 * slices off argv[0] (node) and argv[1] (this script), and it sets its own
 * exit code, so there is nothing to forward.
 */
import 'tw-color-shades/cli';
