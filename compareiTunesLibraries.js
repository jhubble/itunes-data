const fs = require('fs');
const osa = require('osa');

// Convert all the tracks from xml to json
// Run a command like that below for the "old" and the "new" itunes library
// ./cli.js --format json --tracks newTracks.json ~/Downloads/Library.xml
// Then run this to update the itunes library direectly
// it expects node-osa to be in a paralell directory with extended buffer size
// There are a couple of comment notes that are needed
const OLD_LIB = "oldTracksNeat.json";
const NEW_LIB = "newTracksNeat.json";
console.log(`OLD library: ${OLD_LIB}`);
console.log(`NEW library: ${NEW_LIB}`);
const newLib = JSON.parse(fs.readFileSync(NEW_LIB));
const oldLib = JSON.parse(fs.readFileSync(OLD_LIB));

let matched = 0;
const counts = {};
const lastPlayedTimes = {};
console.log("Looking for new songs with no playcount or lesser playcount");
newLib.forEach(song => {
	if (song) {
		const matches = oldLib.filter(oldSong => {
			return (
				oldSong['Play Count'] && (oldSong.Name === song.Name)


		// MOD: comment out Artist check to get "Various" fixes
				&& (oldSong.Artist === song.Artist) 
				&& (oldSong.Album  === song.Album)

			);
		});
		if (matches.length) {
			matched++;
			/*
			matches.forEach(oldSong => {
				console.log(`  ${oldSong['Play Count']} [${oldSong.Name}] - (${oldSong.Album}) { ${oldSong.Artist} } `);
			});
			*/
			if (matches.length === 1) {
				const newCount = matches[0]['Play Count'];
				const newLastPlayed = matches[0]['Play Date UTC'];
				if (!song['Play Count'] || newCount > song['Play Count']) {
					counts[song['Persistent ID']] = newCount;
				}
				if (newLastPlayed && (!song['Play Date UTC'] || song['Play Date UTC'] < newLastPlayed)) {
					lastPlayedTimes[song['Persistent ID']] = new Date(newLastPlayed);
					console.log(`${song['Play Count']} [${song.Name}] - (${song.Album}) { ${song.Artist} } `);
				}
			}
		}
	}
});
console.log("LAST PLAYED:",lastPlayedTimes);
console.log("counts:",counts);


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
  const updateTracks = function(obj) {
	  console.log("track:",obj);
      return osaPromise((counts) => {
	      console.log("counts:",counts);
	      console.log("tstringified",JSON.stringify(counts));
      var itunes = Application('Music');
      var tracks = itunes.libraryPlaylists[0].tracks;
	      let updateCount = 0;
      for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        var id = track.persistentID();
        if (counts[id]) {
	  var playedCount = tracks.playedCount();
	  if (!playedCount || counts[id] > playedCount) {
		  track.playedCount = counts[id];
		  updateCount++;
	  }
        }
      }
	      return updateCount;
    }, counts).then((s)=> {
	    console.log("DONE playcounts updated:",s);
    }); 
  }

// This runs on the Music app. It gets all tracks, and then updates the ones we have
  const updateLastPlayed = function(lastPlayedTimes) {
	  console.log("lastPlayed:",lastPlayedTimes);
      return osaPromise((lastPlayedTimes) => {
	      console.log("LPT:",lastPlayedTimes);
	      console.log("stringified",JSON.stringify(lastPlayedTimes));
      var itunes = Application('Music');
      var tracks = itunes.libraryPlaylists[0].tracks;
      let updateCount = 0;
      for (var i = 0; i < tracks.length; i++) {
        var track = tracks[i];
        var id = track.persistentID();
	if (lastPlayedTimes[id]) {
		console.log("TRACK id:",id);
		console.log("TRACK played:",track.playedDate());
		var currentDate = new Date(track.playedDate() || 0);
		var newDate = new Date(lastPlayedTimes[id]);
		if (currentDate < newDate) {
			track.playedDate = newDate;
			updateCount++;
		}
	}
      }
      return updateCount;
    }, lastPlayedTimes).then((s)=> {
	    console.log("last played updated:",s);
    }); 
  }


console.log(matched);
const countsMatched = Object.keys(counts).length;
const timesMatched = Object.keys(lastPlayedTimes).length;
console.log("counts to update:",countsMatched);
console.log("played times to update",timesMatched);
	updateTracks(counts).then(() => {
		console.log("update tracks done",counts);
		updateLastPlayed(lastPlayedTimes).then(() => {
			console.log("update last played times done",lastPlayedTimes);
		});
	});


