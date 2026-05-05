const PAGES_WITH_POSTS = ['/', '/teacher/{id}/posts', '/admin/posts', '/post/{id}']
const PAGES_WITH_ROAD_MAPS = ['/workflows-list', '/teacher/{id}/road-maps', '/admin/road-maps', '/road-map/{id}']

const ONLY_TEACHERS = ['/create-road-map', '/create-test', '/create-post']
const PRIVATE_PAGES = ['/profile', '/admin', ...ONLY_TEACHERS]
const PUBLICK_PAGES = ['/login', '/register']
