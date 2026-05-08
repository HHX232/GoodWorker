import EditPostPage from '@/_pages/EditPostPage/EditPostPage'

interface Props {
  params: Promise<{id: string}>
}

export default async function EditPostServerPage({params}: Props) {
  const {id} = await params
  return <EditPostPage id={id} />
}
