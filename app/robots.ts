import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/shared/lib/seo/siteUrl'

// Private areas stay out of the index; public pages and posts are open.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/', '/admin', '/lecture/', '/chats', '/files', '/call', '/profile',
        '/student-profile', '/teacher-profile', '/student-calendar', '/calendar', '/statistics',
        '/report', '/homework', '/notifications', '/create-post', '/edit-post', '/create-test',
        '/edit-test', '/create-road-map', '/login', '/register', '/forgot-password',
      ],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
