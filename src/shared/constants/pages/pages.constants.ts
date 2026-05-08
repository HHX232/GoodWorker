const PAGES_WITH_POSTS = ['/', '/teacher/{id}/posts', '/admin/posts', '/post/{id}']
const PAGES_WITH_ROAD_MAPS = ['/workflows-list', '/teacher/{id}/road-maps', '/admin/road-maps', '/road-map/{id}', '/create-road-map']
const PAGES_WITH_TEACHERS = ['/teachers']

const ONLY_TEACHERS_PAGES = ['/create-road-map', '/create-test', '/create-post']
const PAGES_CREATE = ['/create-post', '/edit-post', '/create-road-map', '/create-test']
const PRIVATE_PAGES = ['/profile', '/admin', ...ONLY_TEACHERS_PAGES]
const PUBLICK_PAGES = ['/login', '/register']

export { ONLY_TEACHERS_PAGES, PAGES_CREATE, PAGES_WITH_POSTS, PAGES_WITH_ROAD_MAPS, PAGES_WITH_TEACHERS, PRIVATE_PAGES, PUBLICK_PAGES }
