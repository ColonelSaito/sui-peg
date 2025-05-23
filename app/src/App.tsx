"use client"

import { useCurrentAccount } from "@mysten/dapp-kit"
import { isValidSuiObjectId } from "@mysten/sui/utils"
import { Box, Container, Flex, Heading, Separator } from "@radix-ui/themes"
import { useState } from "react"
import { CreateVault } from "./CreateVault"
import { VaultList } from "./VaultList"
import { Toaster } from "react-hot-toast"
import ConnectButtonWrapper from "@/components/connect-button-wrapper"

function App() {
  const currentAccount = useCurrentAccount()
  const [vaultId, setVaultId] = useState(() => {
    const hash = window.location.hash.slice(1)
    return isValidSuiObjectId(hash) ? hash : null
  })

  return (
    <>
      <Toaster position="top-right" />
      <Flex
        position="sticky"
        px="4"
        py="2"
        justify="between"
        style={{
          borderBottom: "1px solid var(--gray-a2)",
        }}
      >
        <Box>
          <Heading>Depeg Swap</Heading>
        </Box>

        <Box>
          <ConnectButtonWrapper />
        </Box>
      </Flex>

      <Container mt="5">
        <Flex direction="column" gap="6">
          <CreateVault onCreated={setVaultId} />
          <Separator size="4" />
          <VaultList />
        </Flex>
      </Container>
    </>
  )
}

export default App
