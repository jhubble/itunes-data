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
