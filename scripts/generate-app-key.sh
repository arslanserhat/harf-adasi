#!/bin/sh
set -eu

harf_project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$harf_project_dir"

if [ ! -f .env.production ]; then
    echo 'First copy .env.production.example to .env.production and configure APP_URL.' >&2
    exit 1
fi

# The secret is written inside the mounted file. It never enters command-line
# arguments, stdout, a build layer, or a tracked source file.
docker run --rm --user "$(id -u):$(id -g)" \
    --mount "type=bind,src=$harf_project_dir/.env.production,dst=/run/harf.env" \
    --entrypoint php harf-adasi:local -r '
        $path = "/run/harf.env";
        $env = file_get_contents($path);
        if (preg_match("/^APP_KEY=.+$/m", $env)) {
            fwrite(STDERR, "APP_KEY already exists; it was not changed.\n");
            exit(1);
        }
        $key = "base64:".base64_encode(random_bytes(32));
        $env = preg_match("/^APP_KEY=$/m", $env)
            ? preg_replace("/^APP_KEY=$/m", "APP_KEY=".$key, $env)
            : $env."\nAPP_KEY=".$key."\n";
        if (file_put_contents($path, $env, LOCK_EX) === false) {
            exit(1);
        }
        chmod($path, 0600);
        echo "APP_KEY was written to .env.production without displaying it.\n";
    '
