#!/usr/bin/perl
use strict;
use warnings;
use File::Find;
use File::Path qw(make_path);
use File::Basename;
use Time::HiRes qw(gettimeofday tv_interval);  # Import time functions

# Function to convert PNG to SVG using vtracer
sub convert_png_to_svg {
    my ($png_file) = @_;
    my $svg_file = $png_file;
    $svg_file =~ s/\.png$/.svg/;
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

# Function to add fill="currentColor" to every opening <path> element in an SVG that doesn't already have a fill
sub add_fill_to_paths {
    my ($svg_file) = @_;

    # Read the entire file content
    local $/;  # Enable slurp mode
    open my $fh, '<', $svg_file or die "Could not open file '$svg_file': $!\n";
    my $content = <$fh>;
    close $fh;

    # Process only path tags that don't already have a fill attribute
    # Using a more complex regex with negative lookahead to ensure we don't match paths with fill
    $content =~ s/<path\b(?![^>]*\bfill=)/<path fill="currentColor"/g;

    # Write the modified content back to the SVG file
    open my $out_fh, '>', $svg_file or die "Could not write to file '$svg_file': $!\n";
    print $out_fh $content;
    close $out_fh;
}

# Main logic
sub process_directory {
    my ($dir) = @_;
    find(sub {
        return unless -f $_ && /\.png$/i;  # Only process PNG files
        my $png_file = $File::Find::name;

        # Convert PNG to SVG
        my $svg_file = convert_png_to_svg($png_file);

        # Optimize the SVG
        optimize_svg($svg_file);

        # Add fill="currentColor" to every opening <path> element in the SVG that doesn't have fill
        add_fill_to_paths($svg_file);
    }, $dir);
}

# Check for directory argument
if (@ARGV != 1) {
    die "Usage: $0 <directory_with_pngs>\n";
}

# Start the timer
my $start_time = [gettimeofday];

# Process the directory
my $directory = $ARGV[0];
process_directory($directory);

# End the timer
my $elapsed = tv_interval($start_time);

# Print out the elapsed time
printf("Script completed in %.2f seconds\n", $elapsed);
