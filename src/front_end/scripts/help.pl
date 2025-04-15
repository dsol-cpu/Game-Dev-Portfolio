#!/usr/bin/perl
use strict;
use warnings;
use File::Find;
use File::Path qw(make_path);
use File::Basename;
use Time::HiRes qw(gettimeofday tv_interval);
use Cwd 'abs_path';

# Function to convert PNG to SVG using vtracer
sub convert_png_to_svg {
    my ($png_file) = @_;
    my $svg_file = $png_file;
    $svg_file =~ s/\.png$/.svg/i;
    print "Converting $png_file to $svg_file\n";
    system("vtracer", "--input", $png_file, "--output", $svg_file);
    return $svg_file;
}

# Function to optimize SVG using svgo
sub optimize_svg {
    my ($svg_file) = @_;
    print "Optimizing $svg_file\n";
    system("svgo", $svg_file);
}

# Add fill="currentColor" to <path> tags without a fill attribute
sub add_fill_to_paths {
    my ($svg_file) = @_;

    local $/;
    open my $fh, '<', $svg_file or die "Could not open '$svg_file': $!\n";
    my $content = <$fh>;
    close $fh;

    $content =~ s/<path\b(?![^>]*\bfill=)/<path fill="currentColor"/gi;

    open my $out_fh, '>', $svg_file or die "Could not write to '$svg_file': $!\n";
    print $out_fh $content;
    close $out_fh;
}

# Process the directory for PNG files
sub process_directory {
    my ($dir) = @_;
    $dir = abs_path($dir);
    die "'$dir' is not a directory\n" unless -d $dir;

    my @pngs;
    my @svgs;

    # Collect PNGs and SVGs first
    find(sub {
        return unless -f $_;
        my $file = $File::Find::name;
        if ($_ =~ /\.png$/i) {
            push @pngs, $file;
        } elsif ($_ =~ /\.svg$/i) {
            push @svgs, $file;
        }
    }, $dir);

    if (@pngs) {
        print "Found ", scalar(@pngs), " PNG file(s)\n";
        for my $png_file (@pngs) {
            my $svg_file = convert_png_to_svg($png_file);
            optimize_svg($svg_file);
            add_fill_to_paths($svg_file);
        }
    } elsif (@svgs) {
        print "No PNGs found, using ", scalar(@svgs), " existing SVG file(s)\n";
        for my $svg_file (@svgs) {
            optimize_svg($svg_file);
            add_fill_to_paths($svg_file);
        }
    } else {
        print "No PNG or SVG files found in '$dir'\n";
    }
}

# Entry point
sub main {
    if (@ARGV != 1) {
        die "Usage: $0 <directory_with_pngs>\n";
    }

    my $start_time = [gettimeofday];
    process_directory($ARGV[0]);
    my $elapsed = tv_interval($start_time);

    printf("Script completed in %.2f seconds\n", $elapsed);
}

main();