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
const DEBUG = false;
console.log(`Library : ${LIB}`);
console.log(`Scrobbles: ${SCROBBLES}`);
const lib = JSON.parse(fs.readFileSync(LIB));
const scrobbles = JSON.parse(fs.readFileSync(SCROBBLES));
console.error("starting");
const trackCache = {};

// Only include songs with at least MIN_COUNT scrobbles
const MIN_COUNT = 1;

// Only include songs with last place at least MAX_AGE months
const MAX_AGE = 2000;

let time = Date.now();
const showDuration = (name) => {
	console.error("DURATION",Date.now()-time, name);
	time = Date.now();
}

// build the scrobble counts
const scrobbleCounts = {};
const allTracksWithoutAlbum = {};
const librarySongs = {};
const noAlbumLibrary = {};
const noArtistLibrary = {};

let count = 0;			

const mapTree = {excludeArtists:{}, excludeAlbumTracks:{}, excludeAlbums: {}, change: { noAlbum:{}, artistOnly:{}, other:[]}};


const outputKey = (key) => {
	[artist,album,track] = key.split(/\t/);
	const json = {artist:[artist],album:[album],track:[track,track]};
	return JSON.stringify(json);
}
const readTrackMap = () => {
	const trackMap = JSON.parse(fs.readFileSync('trackMap.json'));
	DEBUG && console.log(trackMap);
	// convert regexes to actual regexes
	if (trackMap.strip) {
		Object.keys(trackMap.strip).forEach(k => {
			trackMap.strip[k] = trackMap.strip[k].map(regex => {
				return new RegExp(regex, "i");
			});
		});
	}
	if (trackMap.excludeArtists) {
		trackMap.excludeArtists.forEach(artist => {
			mapTree.excludeArtists[artist.toUpperCase()] = 1;
		});
	}
	if (trackMap.excludeAlbums) {
		trackMap.excludeAlbums.forEach(album => {
			mapTree.excludeAlbums[album.toUpperCase()] = 1;
		});
	}
	if (trackMap.excludeAlbumTracks) {
		mapTree.excludeAlbumTracks = trackMap.excludeAlbumTracks;
	}
	if (trackMap.change) {
		trackMap.change.forEach(rule => {
			if ((!rule.album || rule.album[0] == null)&&
				(rule.track && rule.track[0] != null)&&
				(rule.artist && rule.artist[0] != null)) {
				const ruleKey = `${rule.artist[0]}\t\t${rule.track[0]}`.toUpperCase();
				if (mapTree.change.noAlbum[ruleKey]) {
					console.error(ruleKey,"already exists");
				}
				mapTree.change.noAlbum[ruleKey] = rule;
			}
			else if (!rule.album && !rule.track && rule.artist && rule.artist[0]) {
				if (mapTree.change.artistOnly[rule.artist[0].toUpperCase()]) {
					console.error(rule.artist[0]," rule replacer already exists");
				}
				mapTree.change.artistOnly[rule.artist[0].toUpperCase()] = rule;
			}
			else {
				mapTree.change.other.push(rule);
			}
		});
	}
	return trackMap;
}


const isExcluded = (artist, album, name) => {
	if (mapTree.excludeArtists[(artist||'').toUpperCase()]) {
		return true;
	}
	if (mapTree.excludeAlbumTracks[album]) {
		if (mapTree.excludeAlbumTracks[album].indexOf(name) !== -1) {
			return true;
		}
	}
	if (mapTree.excludeAlbums[(album||'').toUpperCase()]) {
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
				name = name.replace(regex,'');
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
	//
	// First "Artist" rules will be matched
	// Then "other" rules will be mapped
	// Then rules that explicitly do not search for album will be mapped
	// Matches are done in case insensitive manner
	
	const mapRule = (rule, artist, album, track) => {
		const oartist = artist;
		const oalbum = album;
		const otrack = track;
		const macro = (res,item) => {
			res = res.replace('$current',item);
			res = res.replace('$track',otrack);
			res = res.replace('$artist',oartist);
			res = res.replace('$album',oalbum);
			return res;
		};
		if (
			(!rule.artist || rule.artist[0] === null || rule.artist[0].toUpperCase() === artist.toUpperCase()) 
			&&
			(!rule.track || rule.track[0] === null || rule.track[0].toUpperCase() === name.toUpperCase())
			&&
			(!rule.album || rule.album[0] === null || rule.album[0].toUpperCase() === album.toUpperCase())
		) {
			DEBUG && console.log("CHANGE",rule,artist,album,name);
			// Intentional != 
			// If it is not set, or set to null or undefined, we use original value
			// If it is a value (including blank) we will set
			artist = (rule.artist?.[1] != null) ? macro(rule.artist[1],artist) : artist;
			album = (rule.album?.[1] != null) ? macro(rule.album[1],album) : album;
			name = (rule.track?.[1] != null) ? macro(rule.track[1],name) : name;
		}
		return {artist,album,name};
	}

	if (mapTree.change.artistOnly[artist.toUpperCase()]) {
		DEBUG && console.log("artist omly map for ",artist.toUpperCase());
		({artist, album, name} = mapRule(mapTree.change.artistOnly[artist.toUpperCase()],artist, album, name));
	}

		DEBUG && console.log("Running generic map");
	for (let i=0; i<mapTree.change.other.length; i++)  {
		({artist, album, name} = mapRule(mapTree.change.other[i],artist, album, name));
	}

	const ruleKey = `${artist}\t\t${name}`.toUpperCase();
	if (mapTree.change.noAlbum[ruleKey]) {
		DEBUG && console.log("artist name map for ",ruleKey);
		({artist, album, name} = mapRule(mapTree.change.noAlbum[ruleKey],artist, album, name));
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
	if (trackMap?.modify?.tracks) {
		trackMap.modify.tracks.forEach(replacer => {
			name = (name || '').replaceAll(replacer[0],replacer[1]);
		});
	}
	return {artist,album,name};
}


					

const normalize = (artist,album,name) => {
	// Get a normalized artist-album-track key
	// 1. First remove some common ones (temporarily, mainly for debugging)
	// 2. Then call isExcluded to exclude artists/albums (mostly audiobooks). Will return empty string for these (exact match)
	// 3. Then strip out text that we don't wan't (stripText) - mostly remastered, etc.
	//    This uses regex from "strip" section of JSON. These are done case insensitive.
	// 4. Then call modify. This does simple character substitutions on all parts (case sensitive, exact match)
	// 5. Then call mapTrack to do replacements. This will first go through all "normal" strings
	// 6. then mapTrack will go through all strings that do not match on album
	// Three keys are returned. 1 noraml, one without album and one without artist

		//console.log("P",++count,artist,album,name);

	const orig =  `${artist}\t${album}\t${name}`;
	if (DEBUG) {
		const f= "我落淚";
		const re = new RegExp(f);
		if (re.test(name)) {
			console.log("Match:",name);
		}
		else {
			return '';
		}
	}
	if (trackCache.hasOwnProperty(orig)) {
		return trackCache[orig];
	}
	if (isExcluded(artist,album,name)) {
		trackCache[orig] = '';
		return trackCache[orig];
	}
	// temp excludes
	if (
		/Exclude this/.test(album) 
		||
		(/^exclude that/.test(album) && /excludeartist/.test(artist))
	) {
		trackCache[orig] = '';
		return trackCache[orig];
	}


	({artist, album, name} = stripText(artist,album,name));
		DEBUG && console.log(`Post strip:  *${artist}*, *${album}*, *${name}*`);
	({artist, album, name} = modify(artist,album,name));
		DEBUG && console.log(`Post modify:  *${artist}*, *${album}*, *${name}*`);
	({artist, album, name} = mapTrack(artist,album,name));
		DEBUG && console.log(`Post map:  *${artist}*, *${album}*, *${name}*`);

	artist = artist || '';
	album = album || '';
	name = name || '';
	songKey = `${(artist)}\t${(album)}\t${(name)}`;
	noAlbumKey = `${(artist)}\t\t${(name)}`;
	noArtistKey = `\t${(album)}\t${(name)}`;
	trackCache[orig] = {songKey, noAlbumKey,noArtistKey};
	return trackCache[orig];
}

const showSuggestedMerges = ()=> {
	Object.keys(allTracksWithoutAlbum).forEach(noAlbumKey => {
		const songsObj = allTracksWithoutAlbum[noAlbumKey];
		const songs = Object.keys(songsObj);
		if (songs.length > 1) {
			const totalScrobbles = songs.reduce((acc, current) => {
				return acc + songsObj[current].scrobbles;
			},0);
			if (totalScrobbles > 1) {
				// only show if we have multiple tracks with same album and artist
				const sortedSongs = songs.sort((a,b) => { const diff = songsObj[b].scrobbles - songsObj[a].scrobbles; return diff});
				console.log("SORTED SONGS",sortedSongs);
				//console.log("NO ALB KEY:",noAlbumKey,"count:",songs.length);
				console.log("ALL",songsObj);
				console.log("SUGGESTION");
				let [artist,album,name] = sortedSongs[0].split(/\t/);
				if (!album) {
					album = sortedSongs[1].split(/\t/)[1];
				}
				const mapping = {album:[null,album],
					artist:[artist,artist],
					track:[name,name]
				}
				const suggestedMapping = JSON.stringify(mapping);
				console.log(`\t\t${suggestedMapping},`);
			}
		}
	})

}

// Show songs in library that were never scrobbled
const showNeverScrobbled = () => {
	Object.keys(librarySongs)
		.forEach(index => {
			if (!librarySongs[index].scrobbles) {
				if (librarySongs[index]['Total Time'] > 30000) {
					console.log(`-${librarySongs[index]['Play Count']}\t${librarySongs[index]['Play Date UTC']}\t${index}\t${outputKey(index)},`);
				}
				else {
					console.log(`^SHORT${librarySongs[index]['Play Count']}\t${librarySongs[index]['Play Date UTC']}\t${index}\t${outputKey(index)},`);
				}
			}
		})
}

const showMatches = () => {
	// Show matches
	Object.keys(librarySongs)
		.forEach(index => {
			if (librarySongs[index].scrobbles) {
				console.log(`+${librarySongs[index]['Play Count']}(${librarySongs[index].scrobbles})\t${librarySongs[index]['Play Date UTC']}\t${index}\t${outputKey(index)},`);
			}
		});
}

const showTopAlbumsAndArtists = () => {
	// Show the top albums

	const albums = {};
	const artists = {};
	Object.keys(scrobbleCounts)
		.forEach(index => {
			if (!librarySongs[index]) {
				const [artist,album,track] = index.split(/\t/);
				if (!albums[album]) {
					albums[album] = 0;
				}
				albums[album] += scrobbleCounts[index].count;
				if (!artists[artist]) {
					artists[artist] = 0;
				}
				artists[artist] += scrobbleCounts[index].count;
			}
		});

	console.log("\nAlbums");
	const sortedKeys = Object.keys(albums).sort((a,b) => albums[a] - albums[b]);

		sortedKeys.forEach(k => {
		console.log(albums[k],k);
	});

	console.log("\nArtists");
	Object.keys(artists).sort((a,b) => artists[a] - artists[b]).forEach(k => {
		console.log(artists[k],k);
	});
}

const trackMap = readTrackMap();
showDuration("readTrackMap");

scrobbles.forEach(scrobbleSection => {
	scrobbleSection.track.forEach(scrobble => {
		// just get actual scrobbles (not now playing type thing without dates)
		if (scrobble.date) {
			const {songKey, noAlbumKey, noArtistKey }  = normalize(scrobble.artist['#text'], scrobble.album['#text'], scrobble.name);
			if (!allTracksWithoutAlbum[noAlbumKey]) {
				allTracksWithoutAlbum[noAlbumKey] = {};
			}
			if (!allTracksWithoutAlbum[noAlbumKey][songKey]) {
				allTracksWithoutAlbum[noAlbumKey][songKey] = { scrobbles: 0, playCount: 0};
			}
			if (songKey) {
				if (!scrobbleCounts[songKey]) {
					scrobbleCounts[songKey] = { count:0, lastPlayedStamp: (scrobble?.date.uts || 0)*1000, lastPlayed: scrobble?.date['#text'] ||'', noAlbum:noAlbumKey, noArtist: noArtistKey};
				}
				scrobbleCounts[songKey].count++;
				allTracksWithoutAlbum[noAlbumKey][songKey].scrobbles++;
			}
		}
		else {
			// mostly "now playing" without date. Seems to be repeated
	//		console.log("No Date:", scrobble?.name, scrobble?.['@attr']);
		}
	})
});

showDuration("big loop");
console.log(`Library songs: ${lib.length}`);
console.log(`Scrobble songs: ${Object.keys(scrobbleCounts).length}`);
lib.forEach(song => {
	const {songKey, noAlbumKey, noArtistKey} = normalize(song.Artist,song.Album,song.Name);
	librarySongs[songKey] = song;
		if (!allTracksWithoutAlbum[noAlbumKey]) {
			allTracksWithoutAlbum[noAlbumKey] = {};
		}
		if (!allTracksWithoutAlbum[noAlbumKey][songKey]) {
			allTracksWithoutAlbum[noAlbumKey][songKey] = { scrobbles: 0, playCount: 0};
		}
		allTracksWithoutAlbum[noAlbumKey][songKey].playCount = song['Play Count'];
	noAlbumLibrary[noAlbumKey] = songKey;
	noArtistLibrary[noArtistKey] = songKey;
});

showDuration("lib Songs");
const minStamp = Date.now() - MAX_AGE*1000*60*60*24*(365/12);

// show scrobbled but not in library
Object.keys(scrobbleCounts)
	.forEach(index => {
	if (!librarySongs[index]) {
		// Only show those with last played in time frame and minimum number of scrobbles
		if ((scrobbleCounts[index].count >= MIN_COUNT) && (scrobbleCounts[index].lastPlayedStamp > minStamp)) {
			const noAlbum = scrobbleCounts[index].noAlbum;
			const noArtist = scrobbleCounts[index].noArtist;
			output = `${scrobbleCounts[index].count}\t${scrobbleCounts[index].lastPlayed}\t${index}\t${outputKey(index)},`;
			/*
			if (noAlbumLibrary[noAlbum]) {
				console.log(`OTHER ALBUM: (${noAlbumLibrary[noAlbum]}) ${output}`);
			}
			else if (noArtistLibrary[noArtist]) {
				console.log(`OTHER ARTIST: (${noArtistLibrary[noArtist]}) ${output}`);
			}
			else {
				*/
				console.log(`${output}`);
		//	}
		}
	}
	else {
		librarySongs[index].scrobbles = scrobbleCounts[index].count;
	}
});



//showTopAlbumsAndArtists();
showNeverScrobbled();
showMatches();
showSuggestedMerges();
console.error("done");
