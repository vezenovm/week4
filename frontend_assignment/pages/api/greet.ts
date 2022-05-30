import Greeter from "artifacts/contracts/Greeters.sol/Greeters.json"
import { Contract, providers, utils } from "ethers"
import type { NextApiRequest, NextApiResponse } from "next"
import { resolve } from "path/posix"

// This API can represent a backend.
// The contract owner is the only account that can call the `greet` function,
// However they will not be aware of the identity of the users generating the proofs.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { greeting, nullifierHash, solidityProof } = JSON.parse(req.body)

    console.log("greeting: " + greeting, "nullifierHash: " + nullifierHash, "solidityProof: " + solidityProof)
    const contract = new Contract("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512", Greeter.abi)

    // Must use 127.0.0.1 as was getting an error when specifying the address with 'localhost' in the url.
    // This is because on MacOS localhost resolves to IPv6 address ::1 rather than 127.0.0.1 and the hardhot node RPC is bound on IPv4
    const provider = new providers.JsonRpcProvider("http://127.0.0.1:8545")

    const contractOwner = contract.connect(provider.getSigner())

    try {
        let greetingRes = ''
        const tx = await contractOwner.greet(
            utils.formatBytes32String(greeting),
            nullifierHash,
            solidityProof
          );
        const receipt = await tx.wait();
        if (receipt.events.length > 0) {
            const greetingHex = receipt.events[0].args[0];
            greetingRes = utils.parseBytes32String(greetingHex)
        }
        res.status(200).json({ greeting: greetingRes})
    } catch (error: any) {
        // Must use stringify rather than JSON.parse()
        const message  = JSON.stringify(error, null, 2)
        console.log("error message: " + message)
        const reason = message.substring(message.indexOf("'") + 1, message.lastIndexOf("'"))

        res.status(500).send(reason || "Unknown error!")
    }
}
