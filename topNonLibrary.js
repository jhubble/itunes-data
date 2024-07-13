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
const MAX_AGE = 12*5*200;

// For album view, only show tracks with at least this many scrobbles
const MIN_TRACK_SCROBBLES = 1;

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
				DEBUG && console.log("REGEX:",regex);
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

const wasExcluded = {
	excludedArtists: [],
	excludedAlbumTracks: [],
	excludedAlbums: [],
	excludedArtistAlbums: [],

}

const notExcluded = () => {
	showDuration("start not excluded");
	const artistMap = {};
	const albumMap = {};
	const artAlbMap = {};
	const albTracks = {};
	wasExcluded.excludedArtists.forEach(ar => {
		if (!artistMap[ar]) {
			artistMap[ar] = 0;
		}
		artistMap[ar]++;
	});
	Object.keys(mapTree.excludeArtists).forEach(artist => {
		if (!artistMap[artist.toUpperCase()]) {
			console.log("Excluded artist not found:",artist);
		}
	});

	wasExcluded.excludedAlbums.forEach(al => {
		if (!albumMap[al]) {
			albumMap[al] = 0;
		}
		albumMap[al]++;
	});
	Object.keys(mapTree.excludeAlbums).forEach(album => {
		if (!albumMap[album.toUpperCase()]) {
			console.log("Excluded album not found:",album);
		}
	});


	wasExcluded.excludedArtistAlbums.forEach(al => {
		const k = JSON.stringify(al);
		if (!artAlbMap[k]) {
			artAlbMap[k] = 0;
		}
		artAlbMap[k]++;
	});
	trackMap.excludeArtistAlbums.forEach(aa => {
		const k = JSON.stringify(aa);
		if (!artAlbMap[k]) {
			console.log("Excluded artist/album not found:",k);
		}
	});

	 wasExcluded.excludedAlbumTracks.forEach(k => {
		if (!albTracks[k]) {
			albTracks[k] = 0;
		}
		albTracks[k]++;
	 });

	console.log("Matches");

	console.log(JSON.stringify({artistMap,albumMap,artAlbMap,albTracks},null,2));



	  Object.keys(mapTree.excludeAlbumTracks).forEach(album => {
		  mapTree.excludeAlbumTracks[album].forEach(track => {
			  const at = JSON.stringify({album , track});
			  if (!albTracks[at])  {
				console.log("Excluded album track not found:",at);
			  }
		  });
         });



	showDuration("end of not excluded");
}


const isExcluded = (artist, album, name) => {
	const ucArtist = (artist||'').toUpperCase();
	if (mapTree.excludeArtists[ucArtist]) {
		wasExcluded.excludedArtists.push(ucArtist);
		return true;
	}
	if (mapTree.excludeAlbumTracks[album]) {
		if (mapTree.excludeAlbumTracks[album].indexOf(name) !== -1) {
			console.log("Alb track match",album,name);
			wasExcluded.excludedAlbumTracks.push(JSON.stringify({album,track:name}));
			return true;
		}
	}
	const ucAlbum = (album || '').toUpperCase();
	if (mapTree.excludeAlbums[ucAlbum]) {
		wasExcluded.excludedAlbums.push(ucAlbum);
		return true;
	}
	if (trackMap.excludeArtistAlbums) {
		if (trackMap.excludeArtistAlbums.find(exc => {
			if (exc.artist === artist && exc.album === album) {
				wasExcluded.excludedArtistAlbums.push(exc);
				return true;
			}
			return false;
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
	const recentAlbums = {};
	Object.keys(scrobbleCounts)
		.forEach(index => {
			if (!librarySongs[index]) {
				const [artist,album,track] = index.split(/\t/);
				const lastPlayedStamp = scrobbleCounts[index].lastPlayedStamp;
				if (lastPlayedStamp > minStamp) {
					if (track) {
						if (!albums[album]) {
							albums[album] = {}
							albums[album].count = 0;
							albums[album].songCount = 0;
							albums[album].songs = [];
							albums[album].artist = artist;
						}
						albums[album].count += scrobbleCounts[index].count;
						albums[album].songCount += 1;
						albums[album].songs.push({track, artist, count:scrobbleCounts[index].count});
						if (!artists[artist]) {
							artists[artist] = 0;
						}
						artists[artist] += scrobbleCounts[index].count;
						
					}
				}
			}
		});

	console.log("\nALBUMS:");
	console.log("Albums with at least 5 scrobbles not in library. Representative artist in ()");
	const sortedKeys = Object.keys(albums).sort((a,b) => albums[b].count - albums[a].count);


	sortedKeys.forEach(k => {
		if (albums[k].count > 5) {
			console.log(`${albums[k].count} ${k} (${albums[k].artist}) - ${albums[k].songCount} songs\t${JSON.stringify({album:k, artist:albums[k].artist})}`);
			albums[k].songs
			.filter(s => s.count >= MIN_TRACK_SCROBBLES)
			.sort((a,b) => b.count-a.count)
			.forEach(song => {
				const outJson = {artist:[song.artist],album:[k],track:[song.track]};
				console.log(`\t\t${song.track}\t${song.count}\t${JSON.stringify(outJson)}`); });
		}
	});
	console.log("\n-------- end ALBUMS");

	console.log("\nARTISTS:");
	console.log("Artists with at least 5 scrobbles not in library");
	Object.keys(artists).sort((a,b) => artists[b] - artists[a]).forEach(k => {
		if (artists[k] > 5) {
			console.log(artists[k],k);
		}
	});
	console.log("\n--------- end ARTISTS");
}

const mostScrobbledAlbums = () => {

}

const mostScrobbledArtistAndAlbumNotInLibraryAtAll = () => {
	const albums = {};
	const artists = {};
	const missingAlbums = {};
	const missingArtists = {};
	Object.keys(librarySongs).forEach(k => {
		const [artist,album,track] = k.split(/\t/);
		artists[artist] = (artist[artist] || 0) + librarySongs[k];
		albums[album] = (albums[album] || 0) + librarySongs[k];
	});

	Object.keys(scrobbleCounts)
		.forEach(index => {
			const [artist,album,track] = index.split(/\t/);
			if (!albums[album]) {
				if (!missingAlbums[album]) {
					missingAlbums[album] = {}
					missingAlbums[album].count = 0;
					missingAlbums[album].artist = artist;
				}
				missingAlbums[album].count += scrobbleCounts[index].count;
			}
			if (!artists[artist]) {
				if (!missingArtists[artist]) {
					missingArtists[artist] = 0
				}
				missingArtists[artist] += scrobbleCounts[index].count;
			}
		});

	console.log("\nTOP TOTALLY MISSING ALBUMS:");
	console.log("Top albums with no representation at all in library. Representative artist in ()");
	const sortedKeys = Object.keys(missingAlbums).sort((a,b) => missingAlbums[b].count - missingAlbums[a].count).slice(50);


	sortedKeys.forEach(k => {
		console.log(`${missingAlbums[k].count} ${k} (${missingAlbums[k].artist})`);
	});
	console.log("\n-------- end TOTALLY MISSING ALBUMS");

	console.log("\nTOP TOTALLY MISSING ARTISTS:");
	console.log("Top scrobbled artists that are not in library at all");
	Object.keys(missingArtists).sort((a,b) => missingArtists[b] - missingArtists[a]).slice(50).forEach(k => {
		console.log(missingArtists[k],k);
	});
	console.log("\n--------- end TOTALLY MISSING ARTISTS");
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
const showTopNotInLibrary = () => {
	Object.keys(scrobbleCounts).sort((a,b) =>{ return  (scrobbleCounts[b].count - scrobbleCounts[a].count)})
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
}


showTopNotInLibrary();
showTopAlbumsAndArtists();
showNeverScrobbled();
mostScrobbledArtistAndAlbumNotInLibraryAtAll();
showMatches();
showSuggestedMerges();
notExcluded();
console.error("done");
