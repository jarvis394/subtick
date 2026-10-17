#!/bin/sh
set -e
# The master answers before the filer has registered; bucket commands need the filer.
filer_ready() {
  out=$(echo "fs.ls /" | weed shell -master=seaweedfs:9333 2>&1) || return 1
  echo "$out" | grep -q 'filers: \[[0-9a-z]' && ! echo "$out" | grep -q 'error'
}
until filer_ready; do sleep 1; done
weed shell -master=seaweedfs:9333 <<'CMD'
s3.bucket.create -name demos
s3.bucket.create -name clips
fs.configure -locationPrefix=/buckets/demos/ -ttl=30d -apply
CMD
