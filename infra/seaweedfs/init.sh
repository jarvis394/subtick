#!/bin/sh
set -e
until echo "cluster.check" | weed shell -master=seaweedfs:9333 >/dev/null 2>&1; do sleep 1; done
weed shell -master=seaweedfs:9333 <<'CMD'
s3.bucket.create -name demos
s3.bucket.create -name clips
fs.configure -locationPrefix=/buckets/demos/ -ttl=30d -apply
CMD
