#!/bin/sh
#
time node topNonLibrary.js >out.txt  ; cat out.txt|grep SUG |wc -l ;cat out.txt |sort -n  > out2.txt; head -10 out2.txt
