use async_graphql::{
    InputType,
    OutputType,
    InputValueError,
    InputValueResult,
    Value,
    registry::Registry,
    parser::types::Field,
    parser::Positioned,
    ContextSelectionSet,
    registry::MetaType,
    ServerResult,
};
use chrono::{ DateTime, Utc };
use serde::{ Deserialize, Serialize };
use std::borrow::Cow;
use std::fmt;
use std::future::Future;

const DATE_TIME: &str = "DateTime";
const DESCRIPTION: &str = "A scalar representing a date and time in RFC3339 format";
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DateTimeScalar(pub DateTime<Utc>);

impl fmt::Display for DateTimeScalar {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0.to_rfc3339())
    }
}

impl OutputType for DateTimeScalar {
    fn type_name() -> Cow<'static, str> {
        Cow::Borrowed(DATE_TIME)
    }

    fn create_type_info(registry: &mut Registry) -> String {
        registry.create_input_type::<Self, _>(async_graphql::registry::MetaTypeId::Scalar, |_| {
            MetaType::Scalar {
                name: DATE_TIME.to_string(),
                description: Some(DESCRIPTION.to_string()),
                is_valid: None,
                visible: None,
                inaccessible: false,
                tags: vec![],
                specified_by_url: None,
                directive_invocations: vec![],
            }
        })
    }

    fn resolve(
        &self,
        _ctx: &ContextSelectionSet<'_>,
        _field: &Positioned<Field>
    ) -> impl Future<Output = ServerResult<Value>> + Send {
        let value = Value::String(self.0.to_rfc3339());
        async move { Ok(value) }
    }
}

impl InputType for DateTimeScalar {
    type RawValueType = Value;

    fn type_name() -> Cow<'static, str> {
        Cow::Borrowed(DATE_TIME)
    }

    fn create_type_info(registry: &mut Registry) -> String {
        registry.create_input_type::<Self, _>(async_graphql::registry::MetaTypeId::Scalar, |_| {
            MetaType::Scalar {
                name: DATE_TIME.to_string(),
                description: Some(DESCRIPTION.to_string()),
                is_valid: None,
                visible: None,
                inaccessible: false,
                tags: vec![],
                specified_by_url: None,
                directive_invocations: vec![],
            }
        })
    }

    fn parse(value: Option<Value>) -> InputValueResult<Self> {
        match value {
            Some(Value::String(s)) => {
                DateTime::parse_from_rfc3339(&s)
                    .map(|dt| DateTimeScalar(dt.with_timezone(&Utc)))
                    .map_err(|err| InputValueError::custom(err.to_string()))
            }
            Some(v) => Err(InputValueError::expected_type(v)),
            None => Err(InputValueError::custom("No value provided")),
        }
    }

    fn to_value(&self) -> Value {
        Value::String(self.0.to_rfc3339())
    }

    fn as_raw_value(&self) -> Option<&Value> {
        static VALUE: std::sync::OnceLock<Value> = std::sync::OnceLock::new();
        Some(VALUE.get_or_init(|| self.to_value()))
    }
}

impl From<DateTime<Utc>> for DateTimeScalar {
    fn from(dt: DateTime<Utc>) -> Self {
        DateTimeScalar(dt)
    }
}

impl From<DateTimeScalar> for DateTime<Utc> {
    fn from(scalar: DateTimeScalar) -> Self {
        scalar.0
    }
}
