class ConfigStr:
    BU = 'bu'
    SITE = 'site'
    DEPLOY = 'deploy'
    HBASE_CONF_DIR = 'hbase_conf_dir'
    HADOOP_CONF_DIR = 'hadoop_conf_dir'
    KRB5_JAVA_OPTION = 'krb5_java_option'
    CONFIG_FOLDER = '/config'
    CONFIG_FILE = 'config.ini'
    SITE_CONFIG_FILE = 'site_config.ini'
    COMMON = 'COMMON'
    KPI = 'KPI'
    DB = 'DB'

    DEPLOY_TEST = 'test'
    DEPLOY_STAGING = 'staging'
    DEPLOY_PRODUCTION = 'production'
    BU_BG1 = 'BG1'
    BU_BG3 = 'BG3'
    BU_BU5 = 'BU5'
    BU_BU6 = 'BU6'
    BU_CPE = 'CPE'
    BU_CNS = 'CNS'
    BU_BU7 = 'BU7'
    BU_BU8 = 'BU8'
    BU_BU10 = 'BU10'
    BU_HQ = 'HQ'
    BU_HQTEST = 'HQTEST'
    BU_HQSTAGING = 'HQSTAGING'
    BU_HQPROD = 'HQPROD'
    BU_TY = 'TY'
    BU_OTHERS = 'others'
    SITE_HQ = 'HQ'
    SITE_SZ = 'SZ'
    SITE_PSH = 'PSH'
    SITE_PTB = 'PTB'
    SITE_PVN = 'PVN'
    SITE_PCQ = 'PCQ'
    SITE_TY = 'TY'

    ALL_SITE = [
        SITE_HQ, SITE_SZ, SITE_PSH, SITE_PTB, SITE_PVN, SITE_PCQ, SITE_TY
    ]
    ALL_BU = [
        BU_BG1, BU_BG3, BU_BU5, BU_BU6, BU_CPE, BU_CNS, BU_BU7, BU_BU8, BU_BU10, BU_HQ, BU_HQTEST,
        BU_TY, BU_HQSTAGING, BU_HQPROD
    ]
    ALL_DEPLOY = ['test', 'staging', 'production', 'cypress']
    # ALL_DEPLOY = ['test', 'test_dev', 'psh_dev', 'staging', 'production', 'kpi', 'kpi_staging', 'kpi_production']


class ProjectStr:
    BISON = 'BISON'
    TEST = 'TEST'
