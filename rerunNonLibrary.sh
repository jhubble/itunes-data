#!/bin/sh
#
time node topNonLibrary.js >out.txt  ; cat out.txt|grep SUG |wc -l ;cat out.txt |sort -n  > out2.txt; head -5 out2.txt
echo "Not scrobbled:"
cat out2.txt | grep -e '^-' |wc -l
cat out2.txt |grep -e '^-' |cut -f3|sort |uniq -c |sort -n |tail -5
