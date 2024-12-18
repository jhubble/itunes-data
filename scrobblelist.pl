#!/usr/bin/perl -w
use strict;
#
# Takes a list of scrabbles in a tab delim list and outputs in something that resembles JSON itunes library with playcount and last played
# Get scrobbles from https://lastfm.ghan.nl/export/
# After downloading as CSV, convert to TSV for spreadsheet, etc.
# Alternate version Expects the TSV to have most recent scrobbles first with artist, album, track, scrobble time
#
# Usage: cat scrobbles.tsv | perl scrobblelist.pl > library.json
use Data::Dumper;
my %index;
my %dates;
while (<>) {
	chomp;
	s/\s*$//;
	my ($uts,$time,$artist,$artist_mbid,$album,$album_mbid,$track,$track_mbid) = split (/\t/);
	# uncoment to use the simple version outlined above
	#my ($artist,$album,$track,$time) = split (/\t/);
	$artist =~ s/\\'//g;
	$album =~ s/\\'//g;
	$track =~ s/\\'//g;
	$artist =~ s/"/\\"/g;
	$album =~ s/"/\\"/g;
	$track =~ s/"/\\"/g;
	$artist =~ s~\\/~\\/~;
	# Ignore scrobbles with the bogus time
	if ($time eq "01 Jan 1970 0:00") {
		next;
	}
	my $k = "$artist\t$album\t$track";
	if ($index{$k}) {
		$index{$k}++;
	}
	else {
		# Newest scrobbles are first, so we only need the last stamp when creating
		$index{$k} = 1;
		$dates{$k} = $time;
	}
}
print "[\n";
	my $comma = "";
foreach my $k (sort keys %dates) {
	#print "$k\t".$dates{$k}."\t".$index{$k}."\n";
	my ($artist, $album, $name) = split (/\t/,$k);
	my $playDate = $dates{$k};
	my $count = $index{$k};
	print <<EOF1;
	$comma
	{
		"Album":"$album",
		"Artist":"$artist",
		"Name":"$name",
		"Play Date UTC":"$playDate",
		"Play Count":$count
	}


EOF1
$comma=",";
}
print "]\n";
