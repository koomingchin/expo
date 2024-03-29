import { ExpoConfig } from '@expo/config';
import { ConfigPlugin, ExportedConfigWithProps, Mod } from '@expo/config-plugins';

// Usage: add the following mock to the mods you are using:
// jest.mock('../../plugins/android-plugins');

export function mockModWithResults(withMod, modResults) {
  withMod.mockImplementationOnce((config, action) => {
    return action({ ...config, modResults });
  });
}

/**
 * Mock a single mod and evaluate the plugin that uses that mod
 * @param config
 * @param param1
 * @returns
 */
export async function compileMockModWithResultsAsync<T, ConfigPluginProps>(
  config: Partial<ExpoConfig>,
  {
    plugin,
    pluginProps,
    mod,
    modResults,
  }: {
    plugin: ConfigPlugin<ConfigPluginProps>;
    pluginProps?: ConfigPluginProps;
    mod: ConfigPlugin<Mod<T>>;
    modResults: T;
  }
): Promise<ExportedConfigWithProps<T>> {
  mockModWithResults(mod, modResults);
  return (await plugin(config as any, pluginProps)) as ExportedConfigWithProps<T>;
}
