import PostPage from '@/_pages/PublickPages/PostPage/PostPage'

async function PostServerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  
  return <PostPage   id={id}/>
}

export default PostServerPage