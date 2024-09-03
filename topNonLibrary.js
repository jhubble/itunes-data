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
const OLDLIB = "newTracksMegaConsol.json";
const SCROBBLES = "scrobbles_pretty.json";
const DEBUG = false;
const SKIP_MOD= false;
console.log(`Library : ${LIB}`);
console.log(`Scrobbles: ${SCROBBLES}`);
let lib;
let scrobbles;
console.error("starting");
const trackCache = {};

// Only include songs with at least MIN_COUNT scrobbles
const MIN_COUNT = 1;

// Only include songs with last place at least MAX_AGE months
const MAX_AGE = 12*5*8;

// For album view, only show tracks with at least this many scrobbles
const MIN_TRACK_SCROBBLES = 1;

let time = Date.now();

// build the scrobble counts
const scrobbleCounts = {};
const allTracksWithoutAlbum = {};
const librarySongs = {};
const oldLibrarySongs = {};
const noAlbumLibrary = {};
const noArtistLibrary = {};

let count = 0;			
const droppedScrobbles = [];

const minStamp = Date.now() - MAX_AGE*1000*60*60*24*(365/12);

const mapTree = {excludeArtists:{}, excludeTracks: {}, excludeArtistAlbums:{}, excludeAlbumTracks:{}, excludeAlbums: {}, change: { noAlbum:{}, artistOnly:{}, other:[]}};

const mapped = {
	artistOnly: [],
	other: [],
	noAlbum: []
}

const wasExcluded = {
	excludedArtists: [],
	excludedAlbumTracks: [],
	excludedAlbums: [],
	excludedArtistAlbums: [],
	excludedTracks: []

}


const showDuration = (name) => {
	console.error("DURATION",Date.now()-time, name);
	time = Date.now();
}
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
	if (trackMap.excludeArtistAlbums) {
		trackMap.excludeArtistAlbums.forEach(obj => {
			mapTree.excludeArtistAlbums[`${(obj.artist||'').toUpperCase()}\t${(obj.album ||'').toUpperCase()}`] = 1;
		});
	}

	if (trackMap.excludeTracks) {
		trackMap.excludeTracks.forEach(track => {
			mapTree.excludeTracks[`${track.artist[0].toUpperCase()}\t${track.album[0].toUpperCase()}\t${track.track[0].toUpperCase()}`] = 1;
		});
	}
	if (trackMap.excludeAlbumTracks) {
		mapTree.excludeAlbumTracks = trackMap.excludeAlbumTracks;
	}
	if (trackMap.change) {
		trackMap.change.forEach(rule => {
			if (rule.multiple && Array.isArray(rule.multiple) && rule.replace) {
				rule.multiple.forEach(match => {
					const newRule = {
						artist:[match.artist[0],Array.isArray(rule.replace.artist) ? rule.replace.artist[0] : rule.replace.artist],
						album:[match.album[0],Array.isArray(rule.replace.album) ? rule.replace.album[0] : rule.replace.album],
						track:[match.track[0],Array.isArray(rule.replace.track) ? rule.replace.track[0] : rule.replace.track]
					}
					DEBUG && console.log("MULTIPLE RULE: ",newRule);
					mapTree.change.other.push(newRule);
				});
			}
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
	showDuration("read track map");
	return trackMap;
}


const notExcluded = () => {
	console.log("\n\n== Not excluded\n");
	const artistMap = {};
	const albumMap = {};
	const artAlbMap = {};
	const albTracks = {};
	const tracksMap = {};
	wasExcluded.excludedTracks.forEach(ar => {
		if (!tracksMap[ar]) {
			tracksMap[ar] = 0;
		}
		tracksMap[ar]++;
	});
	Object.keys(mapTree.excludeTracks).forEach(track => {
		if (!tracksMap[track]) {
			console.log("Excluded track not found:",track);
		}
	});
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
		if (!artAlbMap[al]) {
			artAlbMap[al] = 0;
		}
		artAlbMap[al]++;
	});
	Object.keys(mapTree.excludeArtistAlbums).forEach(k => {
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

	console.log("\nExclude matches: Matches\n");

	console.log(JSON.stringify({artistMap,albumMap,artAlbMap,albTracks,tracksMap},null,2));



	  Object.keys(mapTree.excludeAlbumTracks).forEach(album => {
		  mapTree.excludeAlbumTracks[album].forEach(track => {
			  const at = JSON.stringify({album , track});
			  if (!albTracks[at])  {
				console.log("Excluded album track not found:",at);
			  }
		  });
         });



	showDuration("not excluded");
}


const isExcluded = (artist, album, name) => {
	const ucArtist = (artist||'').toUpperCase();
	if (mapTree.excludeArtists[ucArtist]) {
		wasExcluded.excludedArtists.push(ucArtist);
		return true;
	}
	if (mapTree.excludeAlbumTracks[album]) {
		if (mapTree.excludeAlbumTracks[album].indexOf(name) !== -1) {
			DEBUG && console.log("Alb track match",album,name);
			wasExcluded.excludedAlbumTracks.push(JSON.stringify({album,track:name}));
			return true;
		}
	}
	const ucAlbum = (album || '').toUpperCase();
	if (mapTree.excludeAlbums[ucAlbum]) {
		wasExcluded.excludedAlbums.push(ucAlbum);
		return true;
	}
	if (mapTree.excludeArtistAlbums) {
		const artAlb = `${(artist ||'').toUpperCase()}\t${(album || '').toUpperCase()}`;
		if (mapTree.excludeArtistAlbums[artAlb]) {
			wasExcluded.excludedArtistAlbums.push(artAlb);
			return true;
		}
	}
	if (mapTree.excludeTracks) {
		const matchString = `${(artist||'').toUpperCase()}\t${(album||'').toUpperCase()}\t${(name||'').toUpperCase()}`;
		DEBUG && console.log(matchString);
		if (mapTree.excludeTracks[matchString]) {
			wasExcluded.excludedTracks.push(matchString);
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
			mapped.other.push(rule);
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
		mapped.artistOnly.push(mapTree.change.artistOnly[artist.toUpperCase()]);
		({artist, album, name} = mapRule(mapTree.change.artistOnly[artist.toUpperCase()],artist, album, name));
	}

		DEBUG && console.log("Running generic map");
	for (let i=0; i<mapTree.change.other.length; i++)  {
		({artist, album, name} = mapRule(mapTree.change.other[i],artist, album, name));
	}

	const ruleKey = `${artist}\t\t${name}`.toUpperCase();
	if (mapTree.change.noAlbum[ruleKey]) {
		mapped.noAlbum.push(mapTree.change.noAlbum[ruleKey]);
		DEBUG && console.log("artist name map for ",ruleKey);
		({artist, album, name} = mapRule(mapTree.change.noAlbum[ruleKey],artist, album, name));
	}

	return {artist,album,name};
};

const rulesMapped = () => {
	console.log("\n\n==Rules mapped (and not mapped)==\n");
	const mapFound = {
		other:{},
		noAlbum:{},
		artistOnly:{}
	};


	mapped.other.forEach(k => {
		const kj = JSON.stringify(k);
		if (!mapFound.other[kj]) {
			mapFound.other[kj] = 0;
		}
		mapFound.other[kj]++;
	});

	mapped.noAlbum.forEach(k => {
		const kj = JSON.stringify(k);
		if (!mapFound.noAlbum[kj]) {
			mapFound.noAlbum[kj] = 0;
		}
		mapFound.noAlbum[kj]++;
	});

	mapped.artistOnly.forEach(k => {
		const kj = JSON.stringify(k);
		if (!mapFound.artistOnly[kj]) {
			mapFound.artistOnly[kj] = 0;
		}
		mapFound.artistOnly[kj]++;
	});

	Object.values(mapTree.change.noAlbum).forEach(k => {
		const kj = JSON.stringify(k);
		if (!mapFound.noAlbum[kj]) {
			console.log(`no Album rule not run\t\t\t${kj}`);
		}
	});
	Object.values(mapTree.change.artistOnly).forEach(k => {
		const kj = JSON.stringify(k);
		if (!mapFound.artistOnly[kj]) {
			console.log(`artist Only rule not run:\t${kj}`);
		}
	});
	Object.values(mapTree.change.other).forEach(k => {
		const kj = JSON.stringify(k);
		if (!mapFound.other[kj]) {
			console.log(`other rule not run:\t\t${kj}`);
		}
	});


	console.log("NEW LIST:");
	console.log('"change":[');

	const artistOnlyOut = Object.keys(mapFound.artistOnly).sort().map(k => {
		return (`\t${k}`);
	}).join(",\n");
	console.log(artistOnlyOut);
	console.log(",");

	console.log("\n\n\n");

	const otherOut= [];
	Object.keys(mapFound.other).sort().forEach(k => {
		if (!mapFound.artistOnly[k] && !mapFound.noAlbum[k]) {
			otherOut.push(`\t\t${k}`);
		}
	});
	console.log(otherOut.join(",\n"));
	console.log(",");
	console.log("\n\n");

	const noAlbumOut = Object.keys(mapFound.noAlbum).sort().map(k => {
		return (`\t\t\t${k}`);
	}).join(",\n");

	console.log(noAlbumOut);

	console.log("\n\n]\n");

	showDuration("show rules Mapped");
}


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
	// 1. First call cache to see if it has already been matched
	// 2. If in debug mode, look at some matches
	// 3. Then strip out text that we don't wan't (stripText) - mostly remastered, etc.
	//    This uses regex from "strip" section of JSON. These are done case insensitive.
	// 4. Then call modify. This does simple character substitutions on all parts (case sensitive, exact match)
	// 5. Then call isExcluded to exclude artists/albums (mostly audiobooks, things removed). Will return empty string for these (exact match)
	// 6. Then call mapTrack to do replacements. This will first go through all "normal" strings
	// 7. then mapTrack will go through all strings that do not match on album
	// Three keys are returned. 1 noraml, one without album and one without artist

		//console.log("P",++count,artist,album,name);

	const orig =  `${artist}\t${album}\t${name}`;
	if (DEBUG) {
		//const f= "我落淚";
		const f= "Crash Test";
		const re = new RegExp(f);
		//if (re.test(name)) {
		if (re.test(artist)) {
			console.log("Match for debug:",artist);
		}
		else {
			return '';
		}
	}
	if (trackCache.hasOwnProperty(orig)) {
		DEBUG && console.log(`CACHE MATCH: ${orig} -> `,trackCache[orig]);
		return trackCache[orig];
	}

	({artist, album, name} = stripText(artist,album,name));
		DEBUG && console.log(`Post strip:  *${artist}*, *${album}*, *${name}*`);
	({artist, album, name} = modify(artist,album,name));
		DEBUG && console.log(`Post modify:  *${artist}*, *${album}*, *${name}*`);

	if (isExcluded(artist,album,name)) {
		DEBUG && console.log(`Excluded (${artist},${album},${name} : ${orig} ; setting to empty`);
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



	if (!SKIP_MOD) {
		({artist, album, name} = mapTrack(artist,album,name));
			DEBUG && console.log(`Post map:  *${artist}*, *${album}*, *${name}*`);
	}

	artist = artist || '';
	album = album || '';
	name = name || '';
	songKey = `${(artist)}\t${(album)}\t${(name)}`;
	noAlbumKey = `${(artist)}\t\t${(name)}`;
	noArtistKey = `\t${(album)}\t${(name)}`;
	// Cache would have been caught at start, if not, we must have alternate version of same thing
	if (trackCache.hasOwnProperty(songKey)) {
		if (trackCache[songKey]) {
			DEBUG && console.log(`SONGKEY EXISTS, updating cache for orig: KEY: ${songKey}, ORIG: ${orig}`);
			const newOrig = trackCache[songKey].orig;
			newOrig.push(orig);
			trackCache[orig] = {...trackCache[songKey], newOrig};
		}
		else {
			DEBUG && console.log(`SONGKEY EXISTS as blank, updating cache for orig: KEY: ${songKey}, ORIG: ${orig}`);
			trackCache[orig] = trackCache[songKey];
		}
	}
	else {
		DEBUG && console.log(`SETTING NEW CACHE, updating cache for orig: KEY: ${songKey}, ORIG: ${orig}`);
		trackCache[orig] = {songKey, noAlbumKey,noArtistKey, orig:[orig,songKey]};
		if (songKey != orig) {
			trackCache[songKey] = trackCache[orig];
		}

	}

	return trackCache[orig];
}

const showSuggestedMerges = ()=> {
	console.log("\n\n==SUGGESTED MERGES\n");
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
				let [artist,album,name] = sortedSongs[0].split(/\t/);
				if (!album) {
					album = sortedSongs[1].split(/\t/)[1];
				}
				const mapping = {album:[null,album],
					artist:[artist,artist],
					track:[name,name]
				}
				const suggestedMapping = JSON.stringify(mapping);
				console.log(`SUGGESTION:\t\t${suggestedMapping},`);
			}
		}
	});
	showDuration("suggested merges");

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
	showDuration("never scrobbled");
}

const showMatches = () => {
	console.log("\n\n==Songs scrobbled and in the library\n");
	// Show matches
	Object.keys(librarySongs)
		.forEach(index => {
			if (librarySongs[index].scrobbles) {
				console.log(`+${librarySongs[index]['Play Count']}(${librarySongs[index].scrobbles})\t${librarySongs[index]['Play Date UTC']}\t${index}\t${outputKey(index)},`);
			}
		});
	showDuration("songs scrobbled in library");
}

const showTopAlbumsAndArtists = () => {
	// Show the top albums

	const albums = {};
	const artists = {};
	const recentAlbums = {};
	Object.keys(scrobbleCounts)
		.forEach(index => {
			const [artist,album,track] = index.split(/\t/);
			const lastPlayedStamp = scrobbleCounts[index].lastPlayedStamp;
			if (!albums[album]) {
				albums[album] = {}
				albums[album].count = 0;
				albums[album].songCount = 0;
				albums[album].songs = [];
				albums[album].goodSongs = [];
				albums[album].goodCount = 0
				albums[album].artist = artist;
			}
			if (!librarySongs[index]) {
				const prev = !!oldLibrarySongs[index];
				if (lastPlayedStamp > minStamp) {
					if (track) {
						albums[album].count += scrobbleCounts[index].count;
						albums[album].songCount += 1;
						albums[album].songs.push({track, artist, count:scrobbleCounts[index].count, prev});
						if (!artists[artist]) {
							artists[artist] = 0;
						}
						artists[artist] += scrobbleCounts[index].count;
						
					}
				}
			}
			else {
				albums[album].goodCount += scrobbleCounts[index].count;
				albums[album].goodSongs.push({track, artist, count:scrobbleCounts[index].count});
			}
		});

	console.log("\n==ALBUMS:==");
	console.log("Albums with at least 5 scrobbles not in library. Representative artist in ()");
	const sortedKeys = Object.keys(albums).sort((a,b) => albums[b].count - albums[a].count);


	sortedKeys.forEach(k => {
		if (albums[k].count > 5) {
			console.log(`= MISSING ALBUM =\t${albums[k].count} ${k} (${albums[k].artist}) - ${albums[k].songCount} songs\t${JSON.stringify({album:k, artist:albums[k].artist})}`);
			console.log(` = MISSING =\t${albums[k].goodSongs.length} songs in library`);
			albums[k].songs
			.filter(s => s.count >= MIN_TRACK_SCROBBLES)
			.sort((a,b) => b.count-a.count)
			.forEach(song => {
				const outJson = {artist:[song.artist],album:[k],track:[song.track]};
				console.log(`= MISSING SONG =\t${song.prev}\t${song.track}\t${song.count}\t${JSON.stringify(outJson)}`); });
		}
	});
	console.log("\n-------- end ALBUMS");

	console.log("\n==ARTISTS:==");
	console.log("Artists with at least 5 scrobbles not in library");
	Object.keys(artists).sort((a,b) => artists[b] - artists[a]).forEach(k => {
		if (artists[k] > 5) {
			console.log(" = MISSING ARTIST =",artists[k],k);
		}
	});
	console.log("\n--------- end ARTISTS");
	showDuration("top albums and artists");
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

	console.log("\n==TOP TOTALLY MISSING ALBUMS:==");
	console.log("Top albums with no representation at all in library. Representative artist in ()");
	const sortedKeys = Object.keys(missingAlbums).sort((a,b) => missingAlbums[b].count - missingAlbums[a].count).slice(50);

	sortedKeys.forEach(k => {
		console.log(`MISSING-ALBUM\t${missingAlbums[k].count} ${k} (${missingAlbums[k].artist})`);
	});
	console.log("\n-------- end TOTALLY MISSING ALBUMS");

	console.log("\n==TOP TOTALLY MISSING ARTISTS:==");
	console.log("Top scrobbled artists that are not in library at all");
	Object.keys(missingArtists).sort((a,b) => missingArtists[b] - missingArtists[a]).slice(50).forEach(k => {
		console.log(`MISSING-ARTIST\t${missingArtists[k]}\t${k}`);
	});
	console.log("\n--------- end TOTALLY MISSING ARTISTS");
	showDuration("most scrobbled not in library at all");
}


const readFiles = () => {
	lib = JSON.parse(fs.readFileSync(LIB));
	oldLib = JSON.parse(fs.readFileSync(OLDLIB));
	scrobbles = JSON.parse(fs.readFileSync(SCROBBLES));
	showDuration("read files");
}

const processScrobbles = () => {
	scrobbles.forEach(scrobbleSection => {
		scrobbleSection.track.forEach(scrobble => {
			// just get actual scrobbles (not now playing type thing without dates)
			if (scrobble.date) {
				const {songKey, noAlbumKey, noArtistKey }  = normalize(scrobble.artist['#text'], scrobble.album['#text'], scrobble.name);

				if (songKey) {
					if (!allTracksWithoutAlbum[noAlbumKey]) {
						allTracksWithoutAlbum[noAlbumKey] = {};
					}
					if (!allTracksWithoutAlbum[noAlbumKey][songKey]) {
						allTracksWithoutAlbum[noAlbumKey][songKey] = { scrobbles: 0, playCount: 0};
					}
					if (!scrobbleCounts[songKey]) {
						scrobbleCounts[songKey] = { count:0, lastPlayedStamp: (scrobble?.date.uts || 0)*1000, lastPlayed: scrobble?.date['#text'] ||'', noAlbum:noAlbumKey, noArtist: noArtistKey};
					}
					scrobbleCounts[songKey].count++;
					allTracksWithoutAlbum[noAlbumKey][songKey].scrobbles++;
				}
				else {
					droppedScrobbles.push({artist:scrobble.artist['#text'], album:scrobble.album['#text'], name:scrobble.name});
				}
			}
			else {
				// mostly "now playing" without date. Seems to be repeated
				DEBUG && console.log("No Date:", scrobble?.name, scrobble?.['@attr']);
			}
		})
	});
	showDuration("processedScrobbles");
}

const processLibrary = () => {
	console.log(`Library songs: ${lib.length}`);
	console.log(`Scrobble songs: ${Object.keys(scrobbleCounts).length}`);
	lib.forEach(song => {
		const {songKey, noAlbumKey, noArtistKey, orig} = normalize(song.Artist,song.Album,song.Name);
		if (songKey) {
			librarySongs[songKey] = {...song, orig};
				if (!allTracksWithoutAlbum[noAlbumKey]) {
					allTracksWithoutAlbum[noAlbumKey] = {};
				}
				if (!allTracksWithoutAlbum[noAlbumKey][songKey]) {
					allTracksWithoutAlbum[noAlbumKey][songKey] = { scrobbles: 0, playCount: 0};
				}
				allTracksWithoutAlbum[noAlbumKey][songKey].playCount = song['Play Count'];
			noAlbumLibrary[noAlbumKey] = songKey;
			noArtistLibrary[noArtistKey] = songKey;
		}
	});
	showDuration("processed library");
	oldLib.forEach(song => {
		const {songKey, noAlbumKey, noArtistKey,orig} = normalize(song.Artist,song.Album,song.Name);
		if (songKey) {
			oldLibrarySongs[songKey] = {...song,orig};
		}
	});
	showDuration("processed old library");
	// Now find items that are deleted from new lib
	Object.keys(oldLibrarySongs).forEach(songKey => {
		if (!librarySongs[songKey]) {
			console.log("Marking for DELETION:",songKey);
			DEBUG && console.log(':',oldLibrarySongs[songKey]);
			trackCache[songKey] = '';
			if (oldLibrarySongs[songKey].orig) {
				oldLibrarySongs[songKey].orig.forEach(o => {
					trackCache[o] = '';
					trackCache[oldLibrarySongs[songKey].orig] = '';
					console.log("Marking for DELETION (orig)",songKey);
					DEBUG && console.log(songKey);
				});
			}
		}
	});
	showDuration("removed songs no longer in library");
}


// show scrobbled but not in library
const showTopNotInLibrary = () => {
	console.log("\n\n==Top Not in Library==\n");
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
	showDuration("show top not in library");
}

const showTopScrobbles = () => {
	console.log("\n\n==TOP SCROBBLES==\n");
	Object.keys(scrobbleCounts)
		.sort((a,b) =>{ return  (scrobbleCounts[b].count - scrobbleCounts[a].count)})
		.filter(sc => { return scrobbleCounts[sc].count >= 100; })
		.forEach(sc => {
			console.log(` = SCROBBLED: =\t${scrobbleCounts[sc].count}\t${scrobbleCounts[sc].lastPlayed}\t${sc}`);
		});
	showDuration("show top scrobbles");
}

// this is miserably broken
// itunes seems to have all library embedded here. 
	// May need to find library to better generate
const writePlayList = (tracks) => {
	let out = `
	<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
		`;
	tracks.forEach(track => {
		out += `<key>${track['Track ID']}</key>
			<dict>`;
		Object.keys(track).forEach(k => {
			const v = track[k];
			out += `<key>${k}</key>`;
			if (typeof v === 'number') {
				out += `<integer>${v}</integer>
					`;
			}
			else if (k.indexOf('Date UTC') !== -1) {
				out += `<date>${v}</date>
					`;
			}
			else if (k.indexOf('Computed') !== -1) {
				out += `<true/>
					`;
			}
			else out += `<string>${v}</string>
				`;
		});
	});
	console.log(out);
}


const topByYear = () => {
	console.log("\n\n==Best Song By Year==\n");
	const years = {};
	Object.keys(librarySongs).forEach(songKey => {
		const year = librarySongs[songKey].Year;
		const rating = librarySongs[songKey].Rating || 0;
		const playCount = librarySongs[songKey]['Play Count'] || 0;
		if (!years[year]) {
			years[year] = librarySongs[songKey];
		}
		else {
			oldRating = years[year].Rating || 0;
			oldPlayCount = years[year]['Play Count'] || 0;
			if (
			   (rating > oldRating) ||
			   ((rating === oldRating) && (playCount > oldPlayCount))
			) {
				years[year] = librarySongs[songKey];
			}
		}
	});
	let lastYear = null;
	const tracks = [];
	Object.keys(years).sort((a,b) => a-b).forEach(year => {
		if (lastYear && ((year - lastYear) != 1)) {
			console.log("GAP!");
		}
		tracks.push(years[year]);
		console.log(`${year}\t${years[year].Name}\t${years[year].Artist}\t${years[year].Rating}\t${years[year]['Play Count']}`);
		lastYear = year;
	});
	//writePlayList(tracks);
	showDuration("top by year");
}

const showLibraryYears = () => {
	console.log("\n\n==Library years==\n");
	const years = {};
	Object.keys(librarySongs).forEach(songKey => {
		const year = librarySongs[songKey].Year;
		if (!years[year]) {
			//console.log(librarySongs[songKey]);
			years[year] = 0;
		}
		years[year]++;
	});
	let lastYear = null;
	Object.keys(years).sort((a,b) => a-b).forEach(year => {
		if (lastYear && ((year - lastYear) != 1)) {
			console.log("GAP!");
		}
		console.log(year,years[year]);
		lastYear = year;
	});
	showDuration("show library years");
}

const songsRemovedFromLibrary = () => {

	console.log("\n\n==Tracks Removed From Library==\n");
	Object.keys(scrobbleCounts).sort((a,b) =>{ return  (scrobbleCounts[b].count - scrobbleCounts[a].count)})
		.forEach(index => {
		if (!librarySongs[index] && oldLibrarySongs[index]){
				output = `REMOVED\t${scrobbleCounts[index].count}\t${scrobbleCounts[index].lastPlayed}\t${index}\t${outputKey(index)},`;
				console.log(`${output}`);
		}
	});
	showDuration("songs removed from library");
}

const showReverseSorted = (name,obj,min=0) => {
	console.log(`\nDropped ${name}`);
	Object.keys(obj)
		.sort((a,b) => { return obj[b] - obj[a]})
		.forEach(k => {
			if (obj[k] > min) {
				console.log(` = DROP ${name}=\t${obj[k]}\t${k}`);
			}
		});
}
const showTopDrops = () => {
	console.log("==Scrobbles that were not included==");
	const droppedArtists = {};
	const droppedTracks = {};
	const droppedAlbums = {};
	const droppedAlbumArtist = {};
	droppedScrobbles.forEach(scrobble => {
		const {artist, album, name} = scrobble;
		droppedArtists[artist] = (droppedArtists[artist] || 0) +1;
		droppedAlbums[album] = (droppedAlbums[album] || 0) +1;
		droppedTracks[name] = (droppedTracks[name] || 0) +1;
		droppedAlbumArtist[`${artist}/${album}`] = (droppedAlbumArtist[`${artist}/${album}`] || 0) +1;
	});

	showReverseSorted("Artists",droppedArtists);
	showReverseSorted("Albums",droppedAlbums);
	showReverseSorted("Tracks",droppedTracks,4);
	showReverseSorted("Artist / Album",droppedAlbumArtist);

	showDuration("show top drops");



}

showDuration("starting");
const trackMap = readTrackMap();
readFiles();
processLibrary();
processScrobbles();
showTopNotInLibrary();
showTopAlbumsAndArtists();
showNeverScrobbled();
mostScrobbledArtistAndAlbumNotInLibraryAtAll();
showMatches();
showSuggestedMerges();
notExcluded();
//rulesMapped();
showTopScrobbles();
showLibraryYears();
songsRemovedFromLibrary();
showTopDrops();
topByYear();
console.error("done");
