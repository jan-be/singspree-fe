# Runs inside the nginx container (check.sh starts it): prints a line for every user agent of /agents.tsv
# that nginx classes otherwise than the file says, then how many it checked.
printf 'server { listen 81; access_log off; location / { default_type text/plain; return 200 $is_bot; } }\n' > /etc/nginx/conf.d/zz-who.conf
nginx -t 2>&1 | grep -v -E 'syntax is ok|test is successful' >&2
nginx 2>/dev/null || exit 3
apk add -q curl >/dev/null 2>&1 || exit 4
tab=$(printf '\t')
grep -v '^#' /agents.tsv | while IFS="$tab" read -r want ua; do
  [ -n "$ua" ] || continue
  got=$(curl -s -m 5 -A "$ua" http://localhost:81/)
  [ "$got" = "$want" ] || echo "WRONG: wanted $want, nginx says ${got:-nothing}: $ua"
done
echo "checked $(grep -v '^#' /agents.tsv | grep -c .)"
