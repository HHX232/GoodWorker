'use client'

import {CreateRoadNavbar, CreateRoadZone} from '@/widgets/RoadMap/UI'
import styles from './CreateRoadMapPage.module.scss'

function CreateRoadMapPage() {
  return (
    <div className={styles.main}>
      <CreateRoadNavbar />
      <CreateRoadZone />
    </div>
  )
}

export default CreateRoadMapPage
