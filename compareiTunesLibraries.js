const fs = require('fs');
const osa = require('osa');

// Convert all the tracks from xml to json
// Run a command like that below for the "old" and the "new" itunes library
// ./cli.js --format json --tracks newTracks.json ~/Downloads/Library.xml
// Then run this to update the itunes library direectly
// it expects node-osa to be in a paralell directory with extended buffer size
// There are a couple of comment notes that 
const newLib = JSON.parse(fs.readFileSync('newTracksNeat.json'));
const oldLib = JSON.parse(fs.readFileSync('oldTracksNeat.json'));

let matched = 0;
const counts = {};
console.log("Looking for new songs with no playcount or lesser playcount");
newLib.forEach(song => {
	if (song) {
		const matches = oldLib.filter(oldSong => {
			return (
				oldSong['Play Count'] && (oldSong.Name === song.Name)
				&& (!song['Play Count']) 

		// MOD: uncomment to also update small playcounts
		// || (oldSong['Play Count'] > song['Play Count']))


		// MOD: comment out Artist check to get "Various" fixes
		//		&& (oldSong.Artist === song.Artist) 
				&& (oldSong.Album  === song.Album)

			);
		});
		if (matches.length) {
			matched++;
			console.log(`${song['Play Count']} ${song.Name}] - (${song.Album}) { ${song.Artist} } `);
			matches.forEach(oldSong => {
				console.log(`  ${oldSong['Play Count']} [${oldSong.Name}] - (${oldSong.Album}) { ${oldSong.Artist} } `);
			});
			if (matches.length === 1) {
				counts[song['Persistent ID']] = matches[0]['Play Count'];
			}
		}
	}
});


// Sections that were mostly lifted from itunes-data

function osaPromise(fn, ...args) {
  return new Promise((resolve, reject) => {
    osa(fn, ...args, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

// This runs on the Music app. It gets all tracks, and then updates the ones we have
  const updateTracks = function(counts) {
      return osaPromise((counts) => {
      var itunes = Application('Music');
      var tracks = itunes.libraryPlaylists[0].tracks;
      for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        var id = track.persistentID();
        if (counts[id]) {
          track.playedCount = counts[id];
        }
      }
    }, counts).then((s)=> {
	    console.log("DONE:",s);
    }); 
  }


console.log(matched);
const numberMatched = Object.keys(counts).length;
console.log("Updating: ",numberMatched);
if (numberMatched) {
	updateTracks(counts).then(() => {
		console.log("update tracks done",counts);
	});
}

console.log("done -waiting for promise");

