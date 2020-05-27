import { inject, observer } from "mobx-react"
import * as lightningPayReq from "bolt11"
import * as React from "react"
import { useEffect, useState } from "react"
import { Alert, Clipboard, Share, StyleSheet, Text, View } from "react-native"
import { Button, Input } from "react-native-elements"
import { ScrollView } from "react-native-gesture-handler"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"
import { IconTransaction } from "../../components/icon-transactions"
import { QRCode } from "../../components/qrcode"
import { Screen } from "../../components/screen"
import { translate } from "../../i18n"
import { palette } from "../../theme/palette"
import functions from "@react-native-firebase/functions"
import { getHash } from "../../utils/lightning"
import { StoreContext } from "../../models"
import { request } from 'graphql-request'
import { GRAPHQL_SERVER_URI } from "../../app"

const styles = StyleSheet.create({
  buttonStyle: {
    backgroundColor: palette.lightBlue,
    marginTop: 18,
    borderRadius: 32,
  },

  icon: {
    color: palette.darkGrey,
    marginRight: 15,
  },

  qr: {
    alignItems: "center",
    flex: 1,
  },

  section: {
    paddingBottom: 8,
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  smallText: {
    color: palette.darkGrey,
    fontSize: 18,
    textAlign: "left",
    // marginBottom: 10,
  },
})

export const ReceiveBitcoinScreen = observer(({ navigation }) => {
  const store = React.useContext(StoreContext)

  const [memo, setMemo] = useState("")
  const [amount, setAmount] = useState(0)
  const [loading, setLoading] = useState(false)

  const createInvoice = async () => {
    setLoading(true)

    let invoice

    try {
      const query = `mutation addInvoice($uid: String, $amount: Int, $memo: String) {
        invoice(uid: $uid) {
          addInvoice(value: $amount, memo: $memo)
        }
      }`

      const result = await request(GRAPHQL_SERVER_URI, query,
        {amount, memo, uid: "1234"}
      )

      invoice = result.invoice.addInvoice
    } catch (err) {
      console.log("error with AddInvoice")
      throw err
    }

    try {
      const invoiceDecoded = lightningPayReq.decode(invoice)
      const hash = getHash(invoiceDecoded)

      navigation.navigate("showQRCode", { invoice, amount, hash })
    } catch (err) {
      Alert.alert(err.toString())
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen backgroundColor={palette.lighterGrey}>
      <ScrollView style={{ flex: 1, paddingTop: 32 }}>
        <View style={{ alignItems: "center" }}>
          <IconTransaction type={"receive"} size={75} color={palette.orange} />
        </View>
        <View style={styles.section}>
          <Text style={styles.smallText}>Note</Text>
          <Input placeholder="Optional" value={memo} onChangeText={(text) => setMemo(text)} />
        </View>
        <View style={styles.section}>
          <Text style={styles.smallText}>Amount</Text>
          <Input
            leftIcon={<Text style={styles.icon}>{translate("common.sats")}</Text>}
            placeholder="0"
            autoFocus={true}
            value={amount.toString()}
            onChangeText={(input) => {
              isNaN(+input) ? setAmount(0) : setAmount(+input)
            }}
            returnKeyType="done"
            keyboardType="number-pad"
            onSubmitEditing={createInvoice}
          />
        </View>
        <View style={{ alignContent: "center", alignItems: "center", marginHorizontal: 48 }}>
          <Button
            buttonStyle={styles.buttonStyle}
            disabledStyle={styles.buttonStyle}
            containerStyle={{width: "100%"}}
            title="Create"
            onPress={createInvoice}
            titleStyle={{ fontWeight: "bold" }}
            loading={loading}
            disabled={loading}
          />
        </View>
      </ScrollView>
    </Screen>
  )
})

export const ShowQRCode = ({ route, navigation }) => {
  const invoice = route.params.invoice
  const hash = route.params.hash
  const amount = route.params.amount

  const shareInvoice = async () => {
    try {
      const result = await Share.share({
        message: invoice,
      })

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // shared with activity type of result.activityType
        } else {
          // shared
        }
      } else if (result.action === Share.dismissedAction) {
        // dismissed
      }
    } catch (error) {
      Alert.alert(error.message)
    }
  }

  const copyInvoice = () => {
    Clipboard.setString(invoice)
    Alert.alert("Invoice has been copied in the clipboard")
  }

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const { data } = await functions().httpsCallable("updatePendingInvoice")(hash)
        if (data === true) {
          success()
        }
      } catch (err) {
        console.tron.warn(`can't ferch invoice ${err}`)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const success = () => {
    const options = {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    }

    ReactNativeHapticFeedback.trigger("notificationSuccess", options)
    Alert.alert("success", "This invoice has been paid", [
      {
        text: translate("common.ok"),
        onPress: () => {
          navigation.goBack(false)
        },
      },
    ])
  }

  return (
    <Screen backgroundColor={palette.lighterGrey}>
      <ScrollView style={{ flex: 1, paddingTop: 32 }}>
        <View style={{ alignItems: "center" }}>
          <IconTransaction type={"receive"} size={75} color={palette.orange} />
        </View>
        <QRCode style={styles.qr} size={280}>
          {invoice}
        </QRCode>
        <View style={{ marginHorizontal: 48 }}>
          <Text style={{ fontSize: 16, alignSelf: "center" }}>Receive {amount} sats</Text>
          <Button
            buttonStyle={styles.buttonStyle}
            disabledStyle={styles.buttonStyle}
            containerStyle={{width: "100%"}}
            title="Share"
            onPress={shareInvoice}
            titleStyle={{ fontWeight: "bold" }}
          />
          <Button
            buttonStyle={styles.buttonStyle}
            disabledStyle={styles.buttonStyle}
            containerStyle={{width: "100%"}}
            title="Copy"
            onPress={copyInvoice}
            titleStyle={{ fontWeight: "bold" }}
          />
        </View>
      </ScrollView>
    </Screen>
  )
}
