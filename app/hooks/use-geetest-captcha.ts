import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { EventSubscription, NativeEventEmitter, NativeModules } from "react-native"
import { gql, useMutation } from "@apollo/client"
import GeetestModule from "react-native-geetest-module"
import { translate } from "../i18n"

const REGISTER_CAPTCHA = gql`
  mutation captchaCreateChallenge {
    captchaCreateChallenge {
      errors {
        message
      }
      result {
        id
        challengeCode
        newCaptcha
        failbackMode
      }
    }
  }
`

type GeetestCaptchaReturn = {
  geetestError: string | null
  geetestValidationData: GeetestValidationData | null
  loadingRegisterCaptcha: boolean
  registerCaptcha: () => void
  resetError: () => void
  resetValidationData: () => void
}

export const useGeetestCaptcha = (): GeetestCaptchaReturn => {
  const [geetestValidationData, setGeetesValidationData] =
    useState<GeetestValidationData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onGeeTestDialogResultListener = useRef<EventSubscription>()
  const onGeeTestFailedListener = useRef<EventSubscription>()

  const [registerCaptchaMutation, { loading: loadingRegisterCaptcha }] = useMutation(
    REGISTER_CAPTCHA,
    {
      fetchPolicy: "no-cache",
    },
  )

  const resetValidationData = useCallback(() => setGeetesValidationData(null), [])
  const resetError = useCallback(() => () => setError(null), [])

  const registerCaptcha = useCallback(async () => {
    const { data } = await registerCaptchaMutation()

    const result = data.captchaCreateChallenge?.result
    const errors = data.captchaCreateChallenge?.errors ?? []
    if (errors.length > 0) {
      setError(errors[0].message)
    } else if (result) {
      const params = {
        success: !result.failbackMode ? 1 : 0,
        challenge: result.challengeCode,
        gt: result.id,
        new_captcha: result.newCaptcha,
      }
      GeetestModule.handleRegisteredGeeTestCaptcha(JSON.stringify(params))
    } else {
      setError(translate("errors.generic"))
    }
  }, [registerCaptchaMutation])

  useEffect(() => {
    GeetestModule.setUp()

    const eventEmitter = new NativeEventEmitter(NativeModules.GeetestModule)

    onGeeTestDialogResultListener.current = eventEmitter.addListener(
      "GT3-->onDialogResult-->",
      (event) => {
        const parsedDialogResult = JSON.parse(event.result)
        setGeetesValidationData({
          geetestChallenge: parsedDialogResult.geetest_challenge,
          geetestSecCode: parsedDialogResult.geetest_seccode,
          geetestValidate: parsedDialogResult.geetest_validate,
        })
      },
    )

    onGeeTestFailedListener.current = eventEmitter.addListener(
      "GT3-->onFailed-->",
      (event) => {
        setError(event.error)
      },
    )

    return () => {
      GeetestModule.tearDown()
      onGeeTestDialogResultListener.current.remove()
      onGeeTestFailedListener.current.remove()
    }
  }, [])

  return useMemo(() => {
    return {
      geetestError: error,
      geetestValidationData,
      loadingRegisterCaptcha,
      registerCaptcha,
      resetError,
      resetValidationData,
    }
  }, [
    error,
    geetestValidationData,
    loadingRegisterCaptcha,
    registerCaptcha,
    resetError,
    resetValidationData,
  ])
}
