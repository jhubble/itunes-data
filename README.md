# itunes-data

Update 2024:
Includes script to compare two itunes libraries and sync playcounts and last palyed. (see below)

Export your iTunes library in easy-to-read formats! Install with npm:

```
$ npm install itunes-data
```

## Node usage
The module's `parser()` function returns an streaming XML parser that emits
events for different types of data that it encounters in Apple's XML-based
[property list](http://en.wikipedia.org/wiki/Property_list) files:

* `track` emits a track (song) object with fields such as `Name`, `Artist`, `Album`, `Genre`, and so on.
* `artist` emits an artist object with fields such as `Name`, `Track Count`, and `Play Count`.
* `album` emits an album object with fields such as `Artist`, `Album Artist`, `Track Count`, and so on.
* `playlist` emits a playlist album with fields such as `Name`, `Tracks` (an array of track objects), and so on.
* `library` emits a big, nested object of your entire library.

```js
var fs = require("fs"),
    itunes = require("itunes-data"),
    parser = itunes.parser(),
    stream = fs.createReadStream("path/to/iTunes Music Library.xml");

parser.on("track", function(track) {
    console.log("track:", track);
});

parser.on("album", function(album) {
    console.log("album:", album);
});

stream.pipe(parser);
```

## Command Line
Or install the command-line utility:

```
$ npm install -g itunes-data
$ itunes-data --help
Export an iTunes library XML file.

Usage: itunes-data [options] [path/to/library.xml]

Options:
  --tracks     Save tracks (songs) to this file
  --playlists  Save playlists to this file
  --artists    Save artists to this file
  --albums     Save albums to this file
  --library    Save the library to this (JSON) file
  --format     Default output file format ('csv', 'tsv', 'json' or 'ldjson')  [default: "csv"]
```

### Examples
Export a all tracks (songs) in your library as comma-separated values (CSV):

```sh
$ itunes-data --tracks tracks.csv ~/Music/iTunes/iTunes\ Music\ Library.xml
```

Export a all albums in your library as tab-separated values:

```sh
$ itunes-data --albums albums.tsv ~/Music/iTunes/iTunes\ Music\ Library.xml
```

Export your entire library as JSON:

```sh
$ itunes-data --library library.json ~/Music/iTunes/iTunes\ Music\ Library.xml
```

If you leave off the filename for any of the `--artists`, `--tracks`,
`--playlists`, `--albums` or `--library` list options the data will be written
to stdout, in which case you probably want to specify the `--format` option as
well. You should only use *one* of the list options in this case! 

```sh
$ itunes-data --artists --format json \
    ~/Music/iTunes/iTunes\ Music\ Library.xml > artists.json
```

# When runninging locally, use ./cli.js to run ./cli.js to run 

# Don't forget to do npm install first

# compareiTunesLibrary.js

This is a very crude tool to import playcounts from one library to another
Take a look at the code to see how to run it.
In general, run the itunes-data commands to export tracklist for old and new
Then run the code to compare and update.
It expects a version of noda-osa to be in parallel directory (with buffer value increased.)

Before running, create the track list (the library can sometimes have issues):
1. Export new library

node cli.js --tracks lib2.json ~/Library.xml
cat lib2.json | jq . >newTracksNeat.json

(repeat the same process to create oldTracksNeat.json)

2. Run the script
node compareiTunesLibrary.js

It will compare the two different versions of JSON libraries.
Playcounts and last palyed dates in the old that are greater than or newer than those in the new file will be updated in your library. (However, a final check will be done to verify that they are actually more up to date than what is in library.)

# scrobblelist.pl

Take a list of scrobbles from last.fm and convert it to something resembling library with counts and last played.
Expect a tab delim file with Artist, Album, Track, Last Played Time

use as :

cat scrobbles.tsv | perl scrobblelist.pl >psuedoLibrary.json

# topNonLibrary.js

Find out what you have been listening to that is not in the library

1. Prepare the library files:
Export iTunes library to home directory and then run:
node cli.js --tracks lib2.json ~/Library.xml
cat lib2.json | jq . >newTracksConsol.json

Do the same with an old version of library to newTracsMegaConsol.json
(You can keep both the same - it just wont tell deleted ones.)

2. Prepare the scrobbles
Download scrobbles in json format from https://lastfm.ghan.nl/export/
cat DOWNLOADEDSCROBBLES.json | jq . > scrobbles_pretty.json

3. run the code
node topNonLibrary.js > output.txt

Error and warning output will appear in console as running.
Lines starting with DURATION show timing

Output will have the result of different analysis:

==Top Not in Library==
Scrobbled songs that are not in library, ordered by number of scrobbles

==ALBUMS:==
Albums with at least 5 scrobbles not in library. Representative artist in ()

==ARTISTS:==
Artists with at least 5 scrobbles not in library

==Top Never Srobbled==
Songs with plays in library, but not scrobbles (numbers start with - for library plays)
May need some tweaking to get scrobbles to properly match

==TOP TOTALLY MISSING ALBUMS:==
Top albums with no representation at all in library.
Shows count of scrobbles

==TOP TOTALLY MISSING ARTISTS:==
Top scrobbled artists that are not in library at all, with scrobble count

==Songs scrobbled and in the library==
All songs scrobbled and in the library

==SUGGESTED MERGES==
Show songs that appear on multiple albums to potentially merge

== Not excluded ==
Items marked to exclude that were not found

==TOP SCROBBLES==
The top scrobbled songs

==Library years==
Songs by year (with Gaps identified)

==Tracks Removed From Library== 
Scrobbles that were not matched due to filters
