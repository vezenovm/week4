import detectEthereumProvider from "@metamask/detect-provider"
import { Strategy, ZkIdentity } from "@zk-kit/identity"
import { generateMerkleProof, Semaphore } from "@zk-kit/protocols"
import { providers } from "ethers"
import Head from "next/head"
import React from "react"
import styles from "../styles/Home.module.css"
import { Formik, Form, Field, ErrorMessage } from 'formik'
import * as Yup from 'yup';


export default function Home() {
    const [logs, setLogs] = React.useState("Connect your wallet and greet!")
    const [greeting, setGreeting] = React.useState("")

    async function greet(values: any) {
        setLogs("Creating your Semaphore identity...")

        const provider = (await detectEthereumProvider()) as any

        await provider.request({ method: "eth_requestAccounts" })

        const ethersProvider = new providers.Web3Provider(provider)
        const signer = ethersProvider.getSigner()
        const message = await signer.signMessage("Sign this message to create your identity!")

        const identity = new ZkIdentity(Strategy.MESSAGE, message)
        const identityCommitment = identity.genIdentityCommitment()
        const identityCommitments = await (await fetch("./identityCommitments.json")).json()

        const merkleProof = generateMerkleProof(20, BigInt(0), identityCommitments, identityCommitment)

        setLogs("Creating your Semaphore proof...")

        const greeting = "Hello I am " + values.name

        const witness = Semaphore.genWitness(
            identity.getTrapdoor(),
            identity.getNullifier(),
            merkleProof,
            merkleProof.root,
            greeting
        )

        const { proof, publicSignals } = await Semaphore.genProof(witness, "./semaphore.wasm", "./semaphore_final.zkey")
        const solidityProof = Semaphore.packToSolidityProof(proof)

        const response = await fetch("/api/greet", {
            method: "POST",
            body: JSON.stringify({
                greeting,
                nullifierHash: publicSignals.nullifierHash,
                solidityProof: solidityProof
            })
        })
        const data = await response.json()
        console.log("response: " + data.greeting)
        setGreeting(data.greeting)

        if (response.status === 500) {
            const errorMessage = await response.text()

            setLogs(errorMessage)
        } else {
            setLogs("Your anonymous greeting is onchain :)")
        }
    }

    return (
        <div className={styles.container}>
            <Head>
                <title>Greetings</title>
                <meta name="description" content="A simple Next.js/Hardhat privacy application with Semaphore." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main className={styles.main}>
                <h1 className={styles.title}>Greetings</h1>

                <p className={styles.description}>A simple Next.js/Hardhat privacy application with Semaphore.</p>

                <div className={styles.logs}>{logs}</div>

                <div>
                    <Formik
                        initialValues={{ name: '', age: '', address: '' }}
                        validationSchema={GreetingSchema}
                        onSubmit={(values) => {
                        setTimeout(() => {
                            console.log(JSON.stringify(values, null, 2));
                            greet(values)
                        }, 400);
                        }}
                    >
                        {({ errors }) => (
                        <Form>
                            <Field id="name" name="name" placeholder="Name" />
                            {errors.name ? (
                                <div>{errors.name}</div>
                            ) : null}
                            <Field id="age" name="age" placeholder="Age"/>
                            {errors.age ? (
                                <div>{errors.age}</div>
                            ) : null}
                            <Field id="address" name="address" placeholder="Address"/>
                            {errors.address ? (
                                <div>{errors.address}</div>
                            ) : null}
                            <button type="submit">
                                Greet
                            </button>
                        </Form>
                        )}
                    </Formik>
                </div>

                <div>
                    <title>New Greeting</title>
                    {greeting}
                </div>

            </main>
        </div>
    )
}

const GreetingSchema = Yup.object().shape({
    name: Yup.string()
      .required('Required'),
    age: Yup.number()
      .min(1, 'Too Young!')
      .max(120, 'Too Old!')
      .required('Required'),
    address: Yup.string().required('Required'),
  });
