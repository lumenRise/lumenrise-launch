const toLaunchSlug = (name: string): string => {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  if (
    slug.length === 0 ||
    slug.length > 100 ||
    slug === 'prelaunch' ||
    slug === 'team'
  ) {
    const error = new Error('Project name must produce a valid, non-reserved slug of 1 to 100 characters');

    error.name = 'LaunchNameConflict';

    throw error;
  }

  return slug;
};

export default toLaunchSlug;
