#!/usr/bin/perl
#
# Takes a list of scrabbles in a tab delim list and outputs in something that resembles JSON itunes library with playcount and last played
# Expects the TSV to have most recent scrobbles first with artist, album, track, scrobble time
#
# Usage: cat scrobbles.tsv | perl scrobblelist.pl > library.json
use Data::Dumper;
my %index;
my %dates;
while (<>) {
	chomp;
	s/\s*$//;
	($a,$b,$c,$time) = split (/\t/);
	$a =~ s/\\'//g;
	$b =~ s/\\'//g;
	$c =~ s/\\'//g;
	# Ignore scrobbles with the bogus time
	if ($time eq "01 Jan 1970 0:00") {
		next;
	}
	my $k = "$a\t$b\t$c";
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
