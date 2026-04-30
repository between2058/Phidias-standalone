from script.client.postgres_wrapper import SimplePostgres
from script.util.config import config
from script.util.logger import get_logger
from release import tracker
import json


class UpdatePGSchema:
    def __init__(self):
        self._logger = get_logger()
        self.pg_db = SimplePostgres(
            db=config["COMMON"]["postgres_database"],
            host=config["COMMON"]["postgres_host"],
            port=config["COMMON"]["postgres_port"],
            user=config["COMMON"]["postgres_user"],
            passwd=config["COMMON"]["postgres_passwd"],
        )
        self.schema = "backend"
        self.default_user_session_setting = json.dumps({"session_quota": 2})
        self.app_description_info = json.dumps(tracker.get_overall_releases())
        self.tables = [
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.application
            (
                "id" SERIAL PRIMARY KEY,
                "status" character varying COLLATE pg_catalog."default" NOT NULL,
                "name" character varying COLLATE pg_catalog."default" NOT NULL,
                "version" character varying COLLATE pg_catalog."default" NOT NULL,
                "profile" character varying COLLATE pg_catalog."default" NOT NULL,
                "options" JSON NOT NULL
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.factory
            (
                "name" character varying COLLATE pg_catalog."default" NOT NULL,
                "longitude" numeric,
                "latitude" numeric,
                "video" character varying COLLATE pg_catalog."default" NOT NULL,
                "icon" bytea,
                "icon_name" character varying COLLATE pg_catalog."default" NOT NULL,
                "application_id" INT,
                CONSTRAINT factory_pkey PRIMARY KEY ("name"),
                CONSTRAINT application_id_fkey FOREIGN KEY (application_id)
                    REFERENCES {self.schema}.application (id) MATCH SIMPLE
                    ON UPDATE NO ACTION
                    ON DELETE CASCADE
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.logo
            (
                id SERIAL PRIMARY KEY,
                icon_name VARCHAR(255),
                icon BYTEA NOT NULL
            )
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.sessions
            (
                factory_name character varying COLLATE pg_catalog."default" NOT NULL,
                session_id character varying COLLATE pg_catalog."default" NOT NULL,
                create_time timestamp with time zone,
                session_info json,
                create_username character varying COLLATE pg_catalog."default" NOT NULL,
                CONSTRAINT sessions_pkey PRIMARY KEY (session_id),
                CONSTRAINT unique_session_id UNIQUE (session_id)
                    INCLUDE(session_id),
                CONSTRAINT sessions_create_username_fkey FOREIGN KEY (create_username)
                    REFERENCES auth.users (username) MATCH SIMPLE
                    ON UPDATE NO ACTION
                    ON DELETE NO ACTION
                    NOT VALID,
                CONSTRAINT sessions_factory_name_fkey FOREIGN KEY (factory_name)
                    REFERENCES {self.schema}.factory (name) MATCH SIMPLE
                    ON UPDATE NO ACTION
                    ON DELETE NO ACTION
            )
            """,
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '{self.schema}' AND table_name = 'roles') THEN
                CREATE SEQUENCE IF NOT EXISTS {self.schema}.roles_id_seq
                    INCREMENT 1
                    START 1
                    MINVALUE 1
                    MAXVALUE 2147483647
                    CACHE 1;
                    CREATE TABLE IF NOT EXISTS {self.schema}.roles
                    (
                        "id" integer NOT NULL DEFAULT nextval('{self.schema}.roles_id_seq'::regclass),
                        "name" character varying(50) COLLATE pg_catalog."default" NOT NULL,
                        "description" text COLLATE pg_catalog."default",
                        "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT roles_pkey PRIMARY KEY (id),
                        CONSTRAINT roles_name_key UNIQUE (name)
                    );
                    
                    ALTER SEQUENCE {self.schema}.roles_id_seq OWNED BY {self.schema}.roles.id;
                    
                    INSERT INTO {self.schema}.roles (name, description) VALUES
                    ('admin', 'Administrator with full access to the system'),
                    ('power_user', 'Power user with elevated access to the system'),
                    ('user', 'Default user with normal access to the system'),
                    ('guest', 'Guest user with restricted access to the system');
                END IF;
            END $$;
            """,
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '{self.schema}' AND table_name = 'permissions') THEN
                    CREATE SEQUENCE IF NOT EXISTS {self.schema}.permissions_id_seq
                        INCREMENT 1
                        START 1
                        MINVALUE 1
                        MAXVALUE 2147483647
                        CACHE 1;
                        
                    CREATE TABLE IF NOT EXISTS {self.schema}.permissions
                    (
                        "id" integer NOT NULL DEFAULT nextval('{self.schema}.permissions_id_seq'::regclass),
                        "name" character varying(50) COLLATE pg_catalog."default" NOT NULL,
                        "description" text COLLATE pg_catalog."default",
                        "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
                        CONSTRAINT permissions_pkey PRIMARY KEY (id),
                        CONSTRAINT permissions_name_key UNIQUE (name)
                    );
                    
                    ALTER SEQUENCE {self.schema}.permissions_id_seq OWNED BY {self.schema}.permissions.id;
                    
                    INSERT INTO {self.schema}.permissions (name, description) VALUES
                    ('users:all', 'Permission to perform all user operations'),
                    ('users:create', 'Permission to create new users'),
                    ('users:read', 'Permission to read users table'),
                    ('users:update', 'Permission to update users table'),
                    ('users:delete', 'Permission to delete users'),
                    ('stream:all', 'Permission to perform all stream operations'),
                    ('stream:create', 'Permission to create stream connections'),
                    ('stream:read', 'Permission to read stream connections'),
                    ('stream:update', 'Permission to update stream connections'),
                    ('stream:delete', 'Permission to delete stream connections');
                END IF;
            END $$;
            """,
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '{self.schema}' AND table_name = 'user_roles') THEN
                    CREATE TABLE IF NOT EXISTS {self.schema}.user_roles
                    (
                        username character varying(50) COLLATE pg_catalog."default" NOT NULL,
                        role_id integer NOT NULL,
                        CONSTRAINT user_roles_pkey PRIMARY KEY (username, role_id),
                        CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id)
                            REFERENCES {self.schema}.roles (id) MATCH SIMPLE
                            ON UPDATE NO ACTION
                            ON DELETE CASCADE
                    );
                    INSERT INTO {self.schema}.user_roles (username, role_id)
                    SELECT
                        u.username,
                        r.id AS role_id
                    FROM
                        auth.users u
                    JOIN
                        {self.schema}.roles r
                    ON
                        u.role = r.name
                    WHERE
                        u.active = TRUE;
                END IF;
            END $$;
            """,
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '{self.schema}' AND table_name = 'role_permissions') THEN
                    CREATE TABLE IF NOT EXISTS {self.schema}.role_permissions
                    (
                        "role_id" integer NOT NULL,
                        "permission_id" integer NOT NULL,
                        CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id),
                        CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id)
                            REFERENCES {self.schema}.permissions (id) MATCH SIMPLE
                            ON UPDATE NO ACTION
                            ON DELETE CASCADE,
                        CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id)
                            REFERENCES {self.schema}.roles (id) MATCH SIMPLE
                            ON UPDATE NO ACTION
                            ON DELETE CASCADE
                    );
                    
                    INSERT INTO {self.schema}.role_permissions (role_id, permission_id) VALUES
                    ((SELECT id FROM {self.schema}.roles WHERE name = 'admin'), (SELECT id FROM {self.schema}.permissions WHERE name = 'users:all')),
                    ((SELECT id FROM {self.schema}.roles WHERE name = 'power_user'), (SELECT id FROM {self.schema}.permissions WHERE name = 'users:read')),
                    ((SELECT id FROM {self.schema}.roles WHERE name = 'power_user'), (SELECT id FROM {self.schema}.permissions WHERE name = 'users:update')),
                    ((SELECT id FROM {self.schema}.roles WHERE name = 'user'), (SELECT id FROM {self.schema}.permissions WHERE name = 'users:read')),
                    ((SELECT id FROM {self.schema}.roles WHERE name = 'admin'), (SELECT id FROM {self.schema}.permissions WHERE name = 'stream:all')),
                    ((SELECT id FROM {self.schema}.roles WHERE name = 'power_user'), (SELECT id FROM {self.schema}.permissions WHERE name = 'stream:create')),
                    ((SELECT id FROM {self.schema}.roles WHERE name = 'power_user'), (SELECT id FROM {self.schema}.permissions WHERE name = 'stream:delete')),
                    ((SELECT id FROM {self.schema}.roles WHERE name = 'power_user'), (SELECT id FROM {self.schema}.permissions WHERE name = 'stream:read')),
                    ((SELECT id FROM {self.schema}.roles WHERE name = 'user'), (SELECT id FROM {self.schema}.permissions WHERE name = 'stream:create')),
                    ((SELECT id FROM {self.schema}.roles WHERE name = 'user'), (SELECT id FROM {self.schema}.permissions WHERE name = 'stream:read'));
                END IF;
            END $$;
            """,
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = '{self.schema}' AND table_name = 'user_permissions') THEN
                    CREATE TABLE IF NOT EXISTS {self.schema}.user_permissions
                    (
                        username character varying(50) COLLATE pg_catalog."default" NOT NULL,
                        permission_id integer NOT NULL,
                        CONSTRAINT user_permissions_pkey PRIMARY KEY (username, permission_id),
                        CONSTRAINT user_permissions_permission_id_fkey FOREIGN KEY (permission_id)
                            REFERENCES {self.schema}.permissions (id) MATCH SIMPLE
                            ON UPDATE NO ACTION
                            ON DELETE CASCADE
                    );
                    
                    INSERT INTO {self.schema}.user_permissions (username, permission_id) VALUES
                    ('roman', (SELECT id FROM {self.schema}.permissions WHERE name = 'users:read'));
                END IF;
            END $$;  
            """,
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.settings
            (
                id SERIAL PRIMARY KEY,
                key character varying(50) UNIQUE NOT NULL,
                value text,
                created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
            )
            """,
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT key FROM {self.schema}.settings WHERE key = 'stream_session' ) THEN    
                    INSERT INTO {self.schema}.settings (key, value) VALUES
                    ('stream_session', '{self.default_user_session_setting}');
                END IF;
            END $$;  
            """,
            f"""
            INSERT INTO
                {self.schema}.settings (key, value)
            VALUES
                ('app_description', '{self.app_description_info}')
            ON CONFLICT ("key") DO UPDATE
            SET
                value = EXCLUDED.value,
                created_at = EXCLUDED.created_at
            """,
        ]

    def create_schema(self):
        create_str = f"""
        CREATE SCHEMA IF NOT EXISTS {self.schema}
        AUTHORIZATION {config["COMMON"]["postgres_user"]};
        """
        self.pg_db.query(create_str, None)
        self.pg_db.commit()
        self._logger.info("create schema succeed")

    def create_table(self):
        for create_str in self.tables:
            self.pg_db.query(create_str, None)
        self.pg_db.commit()
        self._logger.info("create table succeed")


if __name__ == "__main__":
    pg_update = UpdatePGSchema()
    pg_update.create_schema()
    pg_update.create_table()
