import Head from 'next/head';
import styles from '@/styles/Home.module.css';

export default function Home() {
  return (
    <>
      <Head>
        <title>Gantt Chart App</title>
        <meta name="description" content="Gantt chart application" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <div className={styles.container}>
          <h1 className={styles.title}>
            Gantt Chart App
          </h1>
          <p className={styles.description}>
            Project skeleton ready. Start building your Gantt chart features here!
          </p>
        </div>
      </main>
    </>
  );
}