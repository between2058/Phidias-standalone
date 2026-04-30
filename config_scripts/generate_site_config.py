import argparse
import os
import re
from configparser import RawConfigParser
from config_str import ConfigStr


def get_root_folder():
    return os.path.abspath(os.path.dirname(__file__)) + "/.."


class MyRawConfigParser(RawConfigParser):
    """
    set ConfigParser options for case sensitive.
    """

    def __init__(self, defaults=None):
        RawConfigParser.__init__(self, defaults=defaults)

    def optionxform(self, optionstr):
        return optionstr


def gen_config_data(config_data, key, enable_unittest):
    testing_dict = {}
    tempdict = {}
    if enable_unittest:
        for subkey in config_data[key].keys():
            match = re.match("^unittest_(.*)", subkey)
            if match:
                # Get the remaining characters
                remaining_chars = match.group(1)
                testing_dict.update({remaining_chars: config_data[key][subkey]})
            else:
                tempdict.update({subkey: config_data[key][subkey]})
        tempdict.update(testing_dict)
    else:
        for subkey in config_data[key].keys():
            tempdict.update({subkey: config_data[key][subkey]})
    return tempdict


def generate_config_data(site, deploy, config_data, enable_unittest):
    sTitle = site + "\\." + ".*" + "\\." + deploy + "\\."
    returndata = {}
    for key in config_data.keys():
        regex = re.match(sTitle, key)
        if regex != None:
            temp_dict = gen_config_data(
                config_data=config_data, key=key, enable_unittest=enable_unittest
            )
            returndata.update({key: temp_dict})
        if key == ConfigStr.COMMON:
            temp_dict = gen_config_data(
                config_data=config_data, key=key, enable_unittest=enable_unittest
            )
            returndata.update({key: temp_dict})
    old_kv = returndata["COMMON"]
    returndata.update({"COMMON": old_kv})

    returndata[ConfigStr.COMMON].update(
        {ConfigStr.SITE: site, ConfigStr.DEPLOY: deploy}
    )
    return returndata


def generate_config(site="no_site", deploy="no_deploy", enable_unittest=False):
    current_path = os.path.dirname(os.path.abspath(__file__))
    site_config_path = current_path + "/../config/" + ConfigStr.SITE_CONFIG_FILE
    config_path = current_path + "/../config/" + ConfigStr.CONFIG_FILE

    # check config file exist
    if not os.path.isfile(site_config_path):
        raise IOError("{} not exist.".format(site_config_path))

    site_config = MyRawConfigParser()
    site_config.read(site_config_path)

    # check site and deploy
    if site not in ConfigStr.ALL_SITE:
        raise ValueError("'{}' SITE not in {}.".format(site, ConfigStr.ALL_SITE))
    if deploy not in ConfigStr.ALL_DEPLOY:
        raise ValueError("'{}' Deploy not in {}.".format(deploy, ConfigStr.ALL_DEPLOY))

    # generate config data
    write_data = generate_config_data(site, deploy, site_config, enable_unittest)

    # write data
    output_config = MyRawConfigParser()

    # output_config.optionxform = str
    for key in write_data.keys():
        key_name = key

        if site + "." not in key and key != ConfigStr.COMMON:
            raise ValueError("'{}' SITE not in Section.".format(site))
        else:
            key_name = key_name.replace(site + ".", "", 1)
        if "." + deploy + "." not in key and key != ConfigStr.COMMON:
            raise ValueError("'{}' DEPLOY not in Section.".format(site))
        else:
            key_name = key_name.replace("." + deploy + ".", ".", 1)

        if key_name.endswith(".C"):
            common_key_name = key_name.replace(".C", "", 1)
            if not output_config.has_section(common_key_name):
                output_config.add_section(common_key_name)
            for subkey in write_data[key].keys():
                output_config.set(
                    common_key_name, "C_" + subkey, write_data[key][subkey]
                )

            client_key = key_name.replace(".C", "_C")
            if not output_config.has_section(client_key):
                output_config.add_section(client_key)
            for subkey in write_data[key].keys():
                output_config.set(client_key, subkey, write_data[key][subkey])
            continue

        key_name = key_name.replace(".S", "", 1)
        if not output_config.has_section(key_name):
            output_config.add_section(key_name)
        for subkey in write_data[key].keys():
            output_config.set(key_name, subkey, write_data[key][subkey])

    all_bu_list = set(output_config.sections()) - set(["COMMON"])
    all_bu_list = list(set(map(lambda x: x.split("_")[0], all_bu_list)))
    all_bu = ",".join(all_bu_list)
    output_config.set("COMMON", "bu_list", all_bu)

    with open(config_path, "w") as f:
        output_config.write(f)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-t",
        "--unittest",
        help="To run unittest if enabled (Default=True)",
        action="store_true",
    )
    args = parser.parse_args()
    # get env
    site = os.environ.get(ConfigStr.SITE.upper(), "no_site")
    deploy = os.environ.get(ConfigStr.DEPLOY.upper(), "no_deploy")
    generate_config(site=site, deploy=deploy, enable_unittest=args.unittest)
