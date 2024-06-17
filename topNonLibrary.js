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
const MIN_COUNT = 8;

// Only include songs with last place at least MAX_AGE months
const MAX_AGE = 20;

// build the scrobble counts
const scrobbleCounts = {};
const librarySongs = {};
const noAlbumLibrary = {};
const noArtistLibrary = {}

const normalize = (artist,album,name) => {
	// Exclude certain artists (mostly audiobook writers)
	const excludeArtist = new RegExp(/AMIE KAUFMAN|MARGARITA MONTIMORE|DAVID HACKETT FISCHER|JON SCIESZCA|KURT VONNEGUT|FRANK HERBERT|CHIL RAJCHMAN|MALCOLM GLADWELL|DON TAPSCOTT|YAHOO.COM|Roald Dahl|Orson Scott Card|JERRY SPINELLI|LOUISE FITZHUGH|BRANDON SANDERSON|RAY BRADBURY|MIGUEL DE CERVANTES|PETER WALSH/i);
	if (excludeArtist.test(artist)) {
		return '';
	}
	album = (album||'').replace(/[ \-]+disc.*$/i,'');
	//album = '';
	let musicKey = `${(artist||'').trim()}\t${(album||'').trim()}\t${(name||'').trim()}`.toUpperCase();
	if (musicKey.indexOf('PODCAST') !== -1) {
		return '';
	}
	musicKey = musicKey.replaceAll(/\s*\([^)]+\)/g,'');
	musicKey = musicKey.replaceAll(/\s*\([^)]+/g,'');
	musicKey = musicKey.replaceAll(/\s*\[[^\]]+\]/g,'');
	musicKey = musicKey.replaceAll(/\s*&\s*/g,' AND ');
	musicKey = musicKey.replaceAll(/[!"'\.]/g,'');
	musicKey = musicKey.replaceAll(/é/gi, 'E');
	return musicKey;
}
scrobbles.forEach(scrobbleSection => {
	scrobbleSection.track.forEach(scrobble => {
		// just get actual scrobbles (not now playing type thing without dates)
		if (scrobble.date) {
			const track = normalize(scrobble.artist['#text'], scrobble.album['#text'], scrobble.name);
			const noAlbumTrack = normalize(scrobble.artist['#text'], '', scrobble.name);
			const noArtistTrack = normalize('', scrobble.album['#text'], scrobble.name);
			if (track) {
				if (!scrobbleCounts[track]) {
					scrobbleCounts[track] = { count:0, lastPlayedStamp: (scrobble?.date.uts || 0)*1000, lastPlayed: scrobble?.date['#text'] ||'', noAlbum:noAlbumTrack, noArtist: noArtistTrack};
				}
				scrobbleCounts[track].count++;
				//console.log(track);
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
			if (noAlbumLibrary[noAlbum]) {
				console.log(`OTHER ALBUM: (${noAlbumLibrary[noAlbum]}) ${output}`);
			}
			else if (noArtistLibrary[noArtist]) {
				console.log(`OTHER ARTIST: (${noArtistLibrary[noArtist]}) ${output}`);
			}
			else {
				console.log(`${scrobbleCounts[index].count}\t${scrobbleCounts[index].lastPlayed}\t${index}`);
			}
		}
	}
	else {
		librarySongs[index].scrobbles = scrobbleCounts[index].count;
	}
});

// Show songs in library that were never scrobbled
// Uncomment if desired
/*
Object.keys(librarySongs)
	.forEach(index => {
		if (!librarySongs[index].scrobbles) {
			console.log(`-${librarySongs[index]['Play Count']}\t${librarySongs[index]['Play Date UTC']}\t${index}`);
		}
	})
*/
