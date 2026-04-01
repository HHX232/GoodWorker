'use client'

import {CreateRoadNavbar, CreateRoadZone} from '@/widgets/RoadMap/UI'
import {useRouter} from 'next/navigation'
import styles from './CreateRoadMapPage.module.scss'
import {SaveRoadMapButton} from '@/shared/ui/RoadMap/Buttons/SaveRoadMapButton/SaveRoadMapButton'

function CreateRoadMapPage() {
  return (
    <div className={styles.main}>
      <CreateRoadNavbar />
      <CreateRoadZone />
      <div className={styles.footer}>
        <SaveRoadMapButton />
      </div>
    </div>
  )
}

export default CreateRoadMapPage
