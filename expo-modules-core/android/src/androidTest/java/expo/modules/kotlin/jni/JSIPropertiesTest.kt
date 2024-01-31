@file:OptIn(ExperimentalCoroutinesApi::class)

package expo.modules.kotlin.jni

import com.google.common.truth.Truth
import kotlinx.coroutines.ExperimentalCoroutinesApi
import org.junit.Test

internal class JSIPropertiesTest {
  @Test
  fun properties_should_be_present_in_the_getPropertyNames() = withJSIInterop(
    inlineModule {
      Name("TestModule")
      Property("p1") { }
      Property("p2")
        .get { }
        .set { _: String -> }
    }
  ) {
    val keys = evaluateScript("Object.keys(ExpoModules.TestModule)").getArray()

    Truth.assertThat(keys).hasLength(2)

    val p1 = keys[0].getString()
    val p2 = keys[1].getString()

    Truth.assertThat(p1).isEqualTo("p1")
    Truth.assertThat(p2).isEqualTo("p2")
  }

  @Test
  fun getter_should_be_called() = withJSIInterop(
    inlineModule {
      Name("TestModule")
      Property("p1") { return@Property 123 }
      Property("p2").get { return@get 321 }
    }
  ) {
    val p1 = evaluateScript("ExpoModules.TestModule.p1").getDouble().toInt()
    val p2 = evaluateScript("ExpoModules.TestModule.p2").getDouble().toInt()

    Truth.assertThat(p1).isEqualTo(123)
    Truth.assertThat(p2).isEqualTo(321)
  }

  @Test
  fun setter_should_be_called() = withJSIInterop(
    inlineModule {
      var innerValue = 567

      Name("TestModule")
      Property("p")
        .get { innerValue }
        .set { newValue: Int -> innerValue = newValue }
    }
  ) {
    evaluateScript("ExpoModules.TestModule.p = 987")
    val p1 = evaluateScript("ExpoModules.TestModule.p").getDouble().toInt()
    evaluateScript("ExpoModules.TestModule.p = 123")
    val p2 = evaluateScript("ExpoModules.TestModule.p").getDouble().toInt()

    Truth.assertThat(p1).isEqualTo(987)
    Truth.assertThat(p2).isEqualTo(123)
  }

  @Test
  fun returns_undefined_when_getter_is_not_specified() = withJSIInterop(
    inlineModule {
      Name("TestModule")
      Property("p")
    }
  ) {
    val p = evaluateScript("ExpoModules.TestModule.p")
    val undefined = evaluateScript("ExpoModules.TestModule.undefined")

    Truth.assertThat(p.isUndefined()).isTrue()
    Truth.assertThat(undefined.isUndefined()).isTrue()
  }
}
