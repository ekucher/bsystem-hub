#!/usr/bin/env bash
#
# The consumer gate, tested from both directions.
#
# scripts/check-api-contract.py is the only thing connecting this repository to
# the platform it consumes. It has only ever been run against a specification
# and a source tree that agree, which means it has never been shown to catch a
# change that breaks them — and a gate that silently stopped failing is worse
# than no gate, because the badge says otherwise.
#
# So: an additive provider change must pass, and a breaking one must fail and
# say which path and which file.
set -uo pipefail
cd "$(dirname "$0")/../.."

PASSED=0
FAILED=0

ok()  { PASSED=$((PASSED + 1)); printf '  ok    %s\n' "$1"; }
bad() { FAILED=$((FAILED + 1)); printf '  FAIL  %s\n' "$1"; }

check() {
  if [ "$1" = "$2" ]; then ok "$3"; else bad "$3 (got $1, want $2)"; fi
}

contains() { case "$2" in *"$1"*) return 0 ;; *) return 1 ;; esac; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$WORK/src"

# A consumer that asks for two paths.
cat > "$WORK/src/api.ts" <<'TS'
export async function clients() {
  return fetch("/api/v1/clients");
}
export async function client(id: string) {
  return fetch(`/api/v1/clients/${id}`);
}
TS

spec() {
  cat > "$WORK/openapi.yaml" <<YAML
openapi: 3.1.0
info: {title: test, version: 1.0.0}
paths:
$1
YAML
}

run_gate() {
  CONTRACT_SPEC="$WORK/openapi.yaml" CONTRACT_SOURCE="$WORK/src" \
    python3 scripts/check-api-contract.py 2>&1
}

echo "The consumer gate"

# --- The baseline. Without it the two cases below prove nothing: a gate that
# --- fails on everything also "fails on a breaking change".
spec '  /api/v1/clients: {get: {responses: {"200": {description: ok}}}}
  /api/v1/clients/{id}: {get: {responses: {"200": {description: ok}}}}'
output="$(run_gate)"
check "$?" "0" "a consumer whose paths the provider serves passes"

# --- Additive: the provider grows an endpoint this consumer does not use.
spec '  /api/v1/clients: {get: {responses: {"200": {description: ok}}}}
  /api/v1/clients/{id}: {get: {responses: {"200": {description: ok}}}}
  /api/v1/invoices: {get: {responses: {"200": {description: ok}}}}
  /api/v1/invoices/{id}: {get: {responses: {"200": {description: ok}}}}'
output="$(run_gate)"
check "$?" "0" "an additive provider change passes"

# --- Breaking: the provider renames a path the consumer asks for.
spec '  /api/v1/accounts: {get: {responses: {"200": {description: ok}}}}
  /api/v1/clients/{id}: {get: {responses: {"200": {description: ok}}}}'
output="$(run_gate)"
check "$?" "1" "a provider that renamed a path the consumer uses fails the gate"
if contains "/api/v1/clients" "$output"; then
  ok "the failure names the path that disappeared"
else
  bad "the failure does not name the path: $output"
fi
if contains "api.ts" "$output"; then
  ok "the failure names the file that asks for it"
else
  bad "the failure does not name the calling file: $output"
fi

# --- Breaking: the provider removes a path outright.
spec '  /api/v1/clients: {get: {responses: {"200": {description: ok}}}}
  /api/v1/somethingelse: {get: {responses: {"200": {description: ok}}}}'
output="$(run_gate)"
check "$?" "1" "a provider that removed a detail endpoint fails the gate"

# --- The two vacuity guards, which are what stop a misconfigured run from
# --- reporting success having compared nothing.
spec '  /api/v1/clients: {get: {responses: {"200": {description: ok}}}}
  /api/v1/clients/{id}: {get: {responses: {"200": {description: ok}}}}'
rm -f "$WORK/src/api.ts"
output="$(run_gate)"
check "$?" "1" "a consumer that requests nothing is refused rather than passed"

cat > "$WORK/src/api.ts" <<'TS'
export const clients = () => fetch("/api/v1/clients");
TS
spec '  /api/v1/clients: {get: {responses: {"200": {description: ok}}}}'
output="$(run_gate)"
check "$?" "1" "a specification with one path is refused rather than passed"

CONTRACT_SPEC="$WORK/absent.yaml" CONTRACT_SOURCE="$WORK/src" \
  python3 scripts/check-api-contract.py >/dev/null 2>&1
check "$?" "1" "an absent provider fails rather than disappearing"

echo
printf '%d passed, %d failed\n' "$PASSED" "$FAILED"
[ "$FAILED" -gt 0 ] && exit 1
exit 0
