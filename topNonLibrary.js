const fs = require('fs');
const osa = require('osa');

// Convert all the tracks from xml to json
// Run a command like that below for the current itunes library
// ./cli.js --format json --tracks newTracksNeat.json ~/Downloads/Library.xml
//
// Download scrobbles in json format from https://lastfm.ghan.nl/export/ 
// There are a couple of comment notes that are needed
// Change the filenames or (pass them through jq to neatify: cat newTracksNeat.json | jq . > newTracksConsol.json
//
// Names should match the names below
// Run node topNonLibrary.js 

const LIB = "newTracksConsol.json";
const SCROBBLES = "scrobbles_pretty.json";
console.log(`Library : ${LIB}`);
console.log(`Scrobbles: ${SCROBBLES}`);
const lib = JSON.parse(fs.readFileSync(LIB));
const scrobbles = JSON.parse(fs.readFileSync(SCROBBLES));

// Only include songs with at least MIN_COUNT scrobbles
const MIN_COUNT = 1;

// Only include songs with last place at least MAX_AGE months
const MAX_AGE = 2000;

// build the scrobble counts
const scrobbleCounts = {};
const librarySongs = {};
const noAlbumLibrary = {};
const noArtistLibrary = {}

const readTrackMap = () => {
	const trackMap = JSON.parse(fs.readFileSync('trackMap.json'));
	console.log(trackMap);
	// convert regexes to actual regexes
	if (trackMap.strip) {
		Object.keys(trackMap.strip).forEach(k => {
			trackMap.strip[k] = trackMap.strip[k].map(regex => {
				return new RegExp(regex);
			});
		});
	}
	return trackMap;
}

const trackMap = readTrackMap();

const isExcluded = (artist, album, name) => {
	if (trackMap.excludeArtists && trackMap.excludeArtists.indexOf(artist) != -1) {
		return true;
	}
	if (trackMap.excludeArtistAlbums) {
		if (trackMap.excludeArtistAlbums.find(exc => {
			return (exc.artist === artist && exc.album === album);
		})) {
			return true;
		}
	}
	return false;
}

const stripText = (artist, album, name) => {
	if (trackMap.strip) {
		if (trackMap.strip.track && name) {
			trackMap.strip.track.forEach(regex => {
				name = name.replace(new RegExp(regex),'');
			});
		}
		if (trackMap.strip.album && album) {
			trackMap.strip.album.forEach(regex => {
				album = album.replace(regex,'');
			});
		}
		if (trackMap.strip.artist && artist) {
			trackMap.strip.artist.forEach(regex => {
				artist = artist.replace(regex,'');
			});
		}
	}
	return {album,artist,name};
}
const mapTrack = (artist, album, name) => {
	// For change section, can have artist, album, and track sections
	// The sections present will be matched
	// null matches any value
	// "" matches only empty value
	// If the replacement value is empty, nothing will be replaced
	if (trackMap.change) {
		for (let i=0; i<trackMap.change.length; i++)  {
			const sc = trackMap.change[i];
			if (
				(!sc.artist || sc.artist[0] === null || sc.artist[0].toUpperCase() === artist.toUpperCase()) 
				&&
				(!sc.track || sc.track[0] === null || sc.track[0].toUpperCase() === name.toUpperCase())
				&&
				(!sc.album || sc.album[0] === null || sc.album[0].toUpperCase() === album.toUpperCase())
			) {
				//console.log("CHANGE",sc,artist,album,name);
				artist = sc.artist?.[1] ? sc.artist[1] : artist;
				album = sc.album?.[1] ? sc.album[1] : album;
				name = sc.track?.[1] ? sc.track[1] : name;
				break;
			}
		}
	}
	return {artist,album,name};
};

const modify = (artist, album, name) => {
	if (trackMap?.modify?.all) {
		trackMap.modify.all.forEach(replacer => {
			artist = (artist || '').replaceAll(replacer[0],replacer[1]);
			album = (album || '').replaceAll(replacer[0],replacer[1]);
			name = (name || '').replaceAll(replacer[0],replacer[1]);
		});
	}
	return {artist,album,name};
}


					

let count = 0;			
const normalize = (artist,album,name) => {

		//console.log("P",++count,artist,album,name);
	if (isExcluded(artist,album,name)) {
		return '';
	}
	if (/Moana/.test(album)) {
		return '';
	}
	if (/^Here Come/.test(album) && /They Might Be Giants/.test(artist)) {
		return '';
	}
	if (/^Frozen 2/.test(album)) {
		return '';
	}
		//console.log("Post exclude",artist,album,name);


	({artist, album, name} = stripText(artist,album,name));
		//console.log("Post strip  ",artist,album,name);
	({artist, album, name} = modify(artist,album,name));
		//console.log("Post modify ",artist,album,name);
	({artist, album, name} = mapTrack(artist,album,name));
		//console.log("Post map    ",artist,album,name);
	musicKey = `^${(artist||'')}^\t^${(album||'')}^\t^${(name||'')}^`;
	return musicKey;
}
scrobbles.forEach(scrobbleSection => {
	scrobbleSection.track.forEach(scrobble => {
		// just get actual scrobbles (not now playing type thing without dates)
		if (scrobble.date) {
			const track = normalize(scrobble.artist['#text'], scrobble.album['#text'], scrobble.name);
			//console.log(track);
			const noAlbumTrack = normalize(scrobble.artist['#text'], '', scrobble.name);
			const noArtistTrack = normalize('', scrobble.album['#text'], scrobble.name);
			if (track) {
				if (!scrobbleCounts[track]) {
					scrobbleCounts[track] = { count:0, lastPlayedStamp: (scrobble?.date.uts || 0)*1000, lastPlayed: scrobble?.date['#text'] ||'', noAlbum:noAlbumTrack, noArtist: noArtistTrack};
				}
				scrobbleCounts[track].count++;
			}
		}
		else {
			// mostly "now playing" without date. Seems to be repeated
	//		console.log("No Date:", scrobble?.name, scrobble?.['@attr']);
		}
	})
});

console.log(`Library songs: ${lib.length}`);
console.log(`Scrobble songs: ${Object.keys(scrobbleCounts).length}`);
lib.forEach(song => {
	const songKey = normalize(song.Artist,song.Album,song.Name);
	librarySongs[songKey] = song;
	const noAlbumKey = normalize(song.Artist,'',song.Name);
	const noArtistKey = normalize('',song.Album,song.Name);
	noAlbumLibrary[noAlbumKey] = songKey;
	noArtistLibrary[noArtistKey] = songKey;
});

const minStamp = Date.now() - MAX_AGE*1000*60*60*24*(365/12);
Object.keys(scrobbleCounts)
	.forEach(index => {
	if (!librarySongs[index]) {
		// Only show those with last played in time frame and minimum number of scrobbles
		if ((scrobbleCounts[index].count >= MIN_COUNT) && (scrobbleCounts[index].lastPlayedStamp > minStamp)) {
			const noAlbum = scrobbleCounts[index].noAlbum;
			const noArtist = scrobbleCounts[index].noArtist;
			output = `${scrobbleCounts[index].count}\t${scrobbleCounts[index].lastPlayed}\t${index}`;
			/*
			if (noAlbumLibrary[noAlbum]) {
				console.log(`OTHER ALBUM: (${noAlbumLibrary[noAlbum]}) ${output}`);
			}
			else if (noArtistLibrary[noArtist]) {
				console.log(`OTHER ARTIST: (${noArtistLibrary[noArtist]}) ${output}`);
			}
			else {
				*/
				console.log(`${scrobbleCounts[index].count}\t${scrobbleCounts[index].lastPlayed}\t${index}`);
		//	}
		}
	}
	else {
		librarySongs[index].scrobbles = scrobbleCounts[index].count;
	}
});

// Show songs in library that were never scrobbled
// Uncomment if desired

Object.keys(librarySongs)
	.forEach(index => {
		if (!librarySongs[index].scrobbles) {
			console.log(`-${librarySongs[index]['Play Count']}\t${librarySongs[index]['Play Date UTC']}\t${index}`);
		}
	})


// Show matches
Object.keys(librarySongs)
	.forEach(index => {
		if (librarySongs[index].scrobbles) {
			console.log(`+${librarySongs[index]['Play Count']}\t(${librarySongs[index].scrobbles})\t${librarySongs[index]['Play Date UTC']}\t${index}`);
		}
	})
